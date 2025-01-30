import { AttributeValue, DynamoDBClient, paginateQuery, QueryCommand, TransactWriteItemsCommand } from '@aws-sdk/client-dynamodb'
import { ok as assert } from 'node:assert'
import { monotonicFactory, } from 'ulid'
import { ensureInclusive, Position, Range } from './position'
import { getSlice, Slice, sliceEnd, slices, sliceStart } from './slice'
import { marshall, NativeAttributeValue, unmarshall } from '@aws-sdk/util-dynamodb'

export interface EventStoreClient {
  readonly name: string
  readonly eventsTable: string
  readonly metadataTable: string
  readonly byKeyPositionIndexName: string
  readonly client: DynamoDBClient
  readonly nextPosition: (epochMilliseconds: number) => Position
}

export type EventStoreConfig = {
  readonly name: string,
  readonly eventsTable: string
  readonly metadataTable: string
  readonly byKeyPositionIndexName: string
}

export const fromConfig = (config: EventStoreConfig, client: DynamoDBClient, nextPosition?: (epochMilliseconds?: number) => Position): EventStoreClient => ({
  ...config,
  client,
  nextPosition: nextPosition ?? monotonicFactory() as (t: number) => Position
})

export const fromConfigString = (configString: string, client: DynamoDBClient, nextPosition?: (epochMilliseconds?: number) => Position): EventStoreClient =>
  fromConfig(parseConfig(configString), client, nextPosition)

export const parseConfig = (configString: string): EventStoreConfig => {
  try {
    const config = JSON.parse(configString)
    assert(typeof config === 'object', 'config must be an object')
    assert(typeof config.name === 'string', 'name must be a string')
    assert(typeof config.eventsTable === 'string', 'eventsTable must be a string')
    assert(typeof config.metadataTable === 'string', 'metadataTable must be a string')
    assert(typeof config.byKeyPositionIndexName === 'string', 'byKeyPositionIndexName must be a string')
    return config
  } catch (e) {
    throw new Error(`Invalid configString: ${configString}`, { cause: e })
  }
}

export type Pending<D> = {
  readonly type: string
  readonly correlationId?: string
  readonly data: D
}

export type Committed<D> = Pending<D> & {
  readonly key: string
  readonly slice: string
  readonly position: Position
  readonly committedAt: string
}

export type AppendResult =
  | Readonly<{ type: 'unchanged' }>
  | Readonly<{ type: 'appended', count: number, position: Position | undefined }>
  | Readonly<{ type: 'aborted/optimistic-concurrency', error: Error }>
  | Readonly<{ type: 'aborted/unknown', error: unknown }>

export type AppendKeyOptions = Readonly<{
  expectedPosition?: Position,
  idempotencyKey?: string
}>

/**
 * Append events to the event store. Provide an idempotency key to ensure
 * the events are only written once even if the same request is retried.
 */
export const appendKey = async <const D extends NativeAttributeValue>(es: EventStoreClient, key: string, events: readonly Pending<D>[], {
  expectedPosition,
  idempotencyKey
}: AppendKeyOptions = {}
): Promise<AppendResult> => {
  if (events.length === 0) return { type: 'unchanged' }

  const now = Date.now()
  const committedAt = new Date(now).toISOString()
  const items = events.map(e => {
    const position = es.nextPosition(now)
    return {
      Put: {
        TableName: es.eventsTable,
        Item: {
          slice: { S: getSlice(position) },
          key: { S: key },
          committedAt: { S: committedAt },
          correlationId: { S: e.correlationId ?? position },
          position: { S: position },
          type: { S: e.type },
          data: { M: marshall(e.data) }
        },
        ConditionExpression: 'attribute_not_exists(#key)',
        ExpressionAttributeNames: { '#key': 'key' }
      }
    }
  })

  const newPosition = items[items.length - 1].Put.Item.position.S
  try {
    const result = await es.client.send(new TransactWriteItemsCommand({
      ClientRequestToken: idempotencyKey,
      ReturnConsumedCapacity: 'TOTAL',
      TransactItems: [
        {
          Put: {
            TableName: es.metadataTable,
            Item: {
              pk: { S: key },
              sk: { S: 'state' },
              position: { S: newPosition }
            },
            ...expectedPosition ? {
                ConditionExpression: '#position = :expectedPosition',
                ExpressionAttributeNames: { '#position': 'position' },
                ExpressionAttributeValues: { ':expectedPosition': { S: expectedPosition } }
              } : {
                ConditionExpression: 'attribute_not_exists(#position)',
                ExpressionAttributeNames: { '#position': 'position' }
              }
          }
        },
        {
          Put: {
            TableName: es.metadataTable,
            Item: {
              pk: { S: 'slice' },
              sk: { S: getSlice(es.nextPosition(now)) },
            }
          }
        },
        ...items,
      ]
    }))

    return idempotencyKey && wasIdempotent(result.ConsumedCapacity ?? [])
      ? { type: 'unchanged' }
      : { type: 'appended', count: items.length, position: newPosition }
  } catch (e) {
    return mapTransactionError(e)
  }
}

const mapTransactionError = (e: unknown): AppendResult =>
  (e instanceof Error && e.name === 'TransactionCanceledException')
    ? { type: 'aborted/optimistic-concurrency', error: e }
    : { type: 'aborted/unknown', error: e }

/**
 * Read a range of all events from the event store. Range is inclusive, and omitting
 * start will read from the beginning, and ommitting end will read to end of the
 * event store.  Omit range entirely to read all events.
 */
export async function* read<A>(es: EventStoreClient, r: Partial<Range> = {}): AsyncIterable<Committed<A>> {
  const inclusive = ensureInclusive(r)
  const extents = hasStartEnd(inclusive)
    ? inclusive
    : await getExtents(es, inclusive)

  if (extents.start > extents.end) return

  for (const slice of slices(getSlice(extents.start), getSlice(extents.end))) {
    const results = paginateQuery(es,
      {
        TableName: es.eventsTable,
        KeyConditionExpression: '#slice = :slice AND #position between :start AND :end',
        ExpressionAttributeNames: {
          '#slice': 'slice',
          '#position': 'position'
        },
        ExpressionAttributeValues: {
          ':slice': { S: slice },
          ':start': { S: extents.start },
          ':end': { S: extents.end }
        },
      })

    for await (const { Items = [] } of results)
      yield* Items.map(toEvent<A>)
  }
}

const hasStartEnd = (r: Partial<Range>): r is Range => !!(r.start && r.end)

/**
 * Read a range of events for a specific key from the event store. Range is inclusive,
 * and omitting start will read from the beginning, and ommitting end will read to
 * end of the event store.  Omit range entirely to read all events for the specified key.
 */
export async function* readKey<A>(es: EventStoreClient, key: string, r: Partial<Range> = {}): AsyncIterable<Committed<A>> {
  const { start, end } = ensureInclusive(r)

  if (start && end && start > end) return

  const results = paginateQuery(es,
    {
      TableName: es.eventsTable,
      IndexName: es.byKeyPositionIndexName,
      KeyConditionExpression: `#key = :key ${start && end ? 'AND #position between :start AND :end'
        : start ? 'AND #position >= :start'
          : end ? 'AND #position <= :end'
            : ''}`,
      ExpressionAttributeNames: {
        '#key': 'key',
        ...((start || end) && { '#position': 'position' })
      },
      ExpressionAttributeValues: {
        ':key': { S: key },
        ...(start && { ':start': { S: start } }),
        ...(end && { ':end': { S: end } })
      }
    })

  for await (const { Items = [] } of results)
    yield* Items.map(toEvent<A>)
}

/**
 * Read the most recent event for the provided key. This can be
 * useful to peek at the latest event or position for a key.
 */
export const readKeyLatest = async <A>(es: EventStoreClient, key: string): Promise<Committed<A> | undefined> => {
  const { Items = [] } = await es.client.send(new QueryCommand({
    TableName: es.eventsTable,
    IndexName: es.byKeyPositionIndexName,
    KeyConditionExpression: '#key = :key',
    ExpressionAttributeNames: { '#key': 'key' },
    ExpressionAttributeValues: { ':key': { S: key } },
    Limit: 1,
    ScanIndexForward: false
  }))

  return Items[0] && toEvent<A>(Items[0])
}

const getExtents = async (es: EventStoreClient, range: Partial<Range>): Promise<Range> => {
  const [start, end] = await Promise.all([
    es.client.send(new QueryCommand({
      TableName: es.metadataTable,
      KeyConditionExpression: '#pk = :pk',
      ExpressionAttributeNames: { '#pk': 'pk' },
      ExpressionAttributeValues: { ':pk': { S: 'slice' } },
      Limit: 1,
      ScanIndexForward: true
    })),
    es.client.send(new QueryCommand({
      TableName: es.metadataTable,
      KeyConditionExpression: '#pk = :pk',
      ExpressionAttributeNames: { '#pk': 'pk' },
      ExpressionAttributeValues: { ':pk': { S: 'slice' } },
      Limit: 1,
      ScanIndexForward: false
    })),
  ])

  const ps = start.Items?.[0]?.sk.S as Slice | undefined
  const pe = end.Items?.[0]?.sk.S as Slice | undefined

  // Intersect range and store extents
  return {
    start: getStart(ps && sliceStart(ps), range.start),
    end: getEnd(pe && sliceEnd(pe), range.end)
  } as Range
}

const positionMin = '00000000000000000000000000' as Position
const positionMax = '7ZZZZZZZZZZZZZZZZZZZZZZZZZ' as Position

const getStart = (p1: Position | undefined, p2: Position | undefined): Position => {
  if (p1 && p2) return p1 > p2 ? p1 : p2
  return p1 ?? p2 ?? positionMin
}

const getEnd = (p1: Position | undefined, p2: Position | undefined): Position => {
  if (p1 && p2) return p1 < p2 ? p1 : p2
  return p1 ?? p2 ?? positionMax
}

const toEvent = <A>(item: Record<string, AttributeValue>): Committed<A> => ({
  slice: item.slice.S,
  key: item.key.S,
  type: item.type.S,
  position: item.position.S,
  correlationId: item.correlationId.S,
  committedAt: item.committedAt.S,
  data: item.data?.M && unmarshall(item.data.M)
} as Committed<A>)

const wasIdempotent = (consumedCapacity: readonly { readonly CapacityUnits?: number }[]): boolean =>
  0 === consumedCapacity.reduce(
    (acc, { CapacityUnits }) => acc + (CapacityUnits ?? 0), 0
  )
