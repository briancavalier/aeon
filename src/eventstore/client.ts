import { AttributeValue, DynamoDBClient, GetItemCommand, paginateQuery, TransactWriteItemsCommand } from '@aws-sdk/client-dynamodb'
import { ok as assert } from 'node:assert'
import { monotonicFactory, } from 'ulid'
import { end, ensureInclusive, InclusiveRange, Position, RangeInput, start } from './position'
import { getSlice, Slice } from './slice'
import { marshall, NativeAttributeValue, unmarshall } from '@aws-sdk/util-dynamodb'
import { Pending, Committed } from './event'
import { paginate } from './dynamodb/paginate'
import { Filter } from './filter'
import { toFilterExpression } from './dynamodb/filter-expression'

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

export type AppendResult =
  | Readonly<{ type: 'unchanged' }>
  | Readonly<{ type: 'appended', count: number, position: Position }>
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
export const append = async <const D extends NativeAttributeValue>(es: EventStoreClient, key: string, events: readonly Pending<D>[], {
  expectedPosition = end,
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
          correlationId: e.correlationId ? { S: e.correlationId } : { NULL: true },
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
            ...expectedPosition === end ? {}
              : expectedPosition === start ? {
                ConditionExpression: 'attribute_not_exists(#position)',
                ExpressionAttributeNames: { '#position': 'position' },
              } : {
                ConditionExpression: '#position = :expectedPosition',
                ExpressionAttributeNames: { '#position': 'position' },
                ExpressionAttributeValues: { ':expectedPosition': { S: expectedPosition } }
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

type ReadInput = RangeInput & Readonly<{
  filter?: Filter<string>
}>

/**
 * Read a range of all events from the event store. Range is inclusive, and omitting
 * start will read from the beginning, and ommitting end will read to end of the
 * event store.  Omit range entirely to read all events.
 */
export async function* readAll<A>(es: EventStoreClient, { filter, ...r }: ReadInput = {}): AsyncIterable<Committed<A>> {
  const range = ensureInclusive(r)
  if (range.limit <= 0 || range.start > range.end) return

  const f = filter ? toFilterExpression(filter) : {}

  const slices = getSlices(es, range)

  for await (const page of slices) {
    for (const slice of page) {
      const results = paginate(es.client, range.limit,
        {
          TableName: es.eventsTable,
          KeyConditionExpression: '#slice = :slice AND #position between :start AND :end',
          FilterExpression: f.FilterExpression,
          ExpressionAttributeNames: {
            ...f.ExpressionAttributeNames,
            '#slice': 'slice',
            '#position': 'position'
          },
          ExpressionAttributeValues: {
            ...f.ExpressionAttributeValues,
            ':slice': { S: slice },
            ':start': { S: range.start },
            ':end': { S: range.end }
          },
          ScanIndexForward: range.direction === 'forward'
        })

      for await (const item of results) yield toEvent<A>(item)
    }
  }
}

export const readForAppend = async <A>(es: EventStoreClient, key: string, r: ReadInput = {}): Promise<readonly [Position, AsyncIterable<Committed<A>>]> => {
  const position = await es.client.send(new GetItemCommand({
    TableName: es.metadataTable,
    Key: { pk: { S: key }, sk: { S: 'state' } }
  })).then(({ Item }) => Item?.position.S as Position | undefined)

  return [position ?? start, read<A>(es, key, { end: position, ...r })]
}

/**
 * Read a range of events for a specific key from the event store. Range is inclusive,
 * and omitting start will read from the beginning, and ommitting end will read to
 * end of the event store.  Omit range entirely to read all events for the specified key.
 */
export async function* read<A>(es: EventStoreClient, key: string, { filter, ...r }: ReadInput = {}): AsyncIterable<Committed<A>> {
  const range = ensureInclusive(r)

  if (range.start && range.end && range.start > range.end) return

  const f = filter ? toFilterExpression(filter) : {}

  const results = paginate(es.client, range.limit,
    {
      TableName: es.eventsTable,
      IndexName: es.byKeyPositionIndexName,
      KeyConditionExpression: `#key = :key ${start && end ? 'AND #position between :start AND :end'
        : start ? 'AND #position >= :start'
          : end ? 'AND #position <= :end'
            : ''}`,
      FilterExpression: f.FilterExpression,
      ExpressionAttributeNames: {
        ...f.ExpressionAttributeNames,
        '#key': 'key',
        ...((start || end) && { '#position': 'position' })
      },
      ExpressionAttributeValues: {
        ...f.ExpressionAttributeValues,
        ':key': { S: key },
        ...(start && { ':start': { S: start } }),
        ...(end && { ':end': { S: end } })
      },
      ScanIndexForward: r.direction === 'forward'
    })

  for await (const item of results) yield toEvent<A>(item)
}

/**
 * Read the most recent event for the provided key. This can be
 * useful to peek at the latest event or position for a key.
 */
export const readLatest = async <A>(es: EventStoreClient, key: string): Promise<Committed<A> | undefined> => {
  const results = read<A>(es, key, { limit: 1, direction: 'backward' })
  for await (const event of results) return event
}

async function* getSlices(es: EventStoreClient, range: InclusiveRange): AsyncIterable<readonly Slice[]> {
  const pages = paginateQuery(es, {
    TableName: es.metadataTable,
    KeyConditionExpression: '#pk = :pk and #sk between :start and :end',
    ExpressionAttributeNames: {
      '#pk': 'pk',
      '#sk': 'sk'
    },
    ExpressionAttributeValues: {
      ':pk': { S: 'slice' },
      ':start': { S: getSlice(range.start) },
      ':end': { S: getSlice(range.end) },
    },
    ScanIndexForward: range.direction === 'forward'
  })

  for await (const { Items = [] } of pages)
    yield Items.map(item => item.sk.S as Slice)
}

const toEvent = <A>(item: Record<string, AttributeValue>): Committed<A> => ({
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
