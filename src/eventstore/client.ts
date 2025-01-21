import { AttributeValue, DynamoDBClient, paginateQuery, QueryCommand, TransactWriteItemsCommand } from '@aws-sdk/client-dynamodb'
import assert from 'node:assert'
import { monotonicFactory, } from 'ulid'
import { Position, Range } from './position'
import { getSlice, Slice, sliceEnd, slices, sliceStart } from './slice'

export interface EventStoreClient {
  readonly name: string
  readonly eventsTable: string
  readonly metadataTable: string
  readonly client: DynamoDBClient
  readonly nextPosition: (epochMilliseconds: number) => Position
}

export type EventStoreConfig = {
  readonly name: string,
  readonly eventsTable: string
  readonly metadataTable: string
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
    assert(config)
    assert(typeof config.name === 'string', 'name must be a string')
    assert(typeof config.eventsTable === 'string', 'eventsTable must be a string')
    assert(typeof config.metadataTable === 'string', 'metadataTable must be a string')
    return config
  } catch (e) {
    throw new Error(`Invalid configString: ${configString}`, { cause: e })
  }
}

export type Pending<D> = {
  readonly key: string
  readonly type: string
  readonly timestamp: string // RFC3339 UTC datetime
  readonly data: D
}

/**
 * Append events to the event store. Provide an idempotency key to ensure
 * the events are only written once even if the same request is retried.
 */
export const append = async <const D>(es: EventStoreClient, e: readonly Pending<D>[], idempotencyKey?: string): Promise<Position | undefined> => {
  if (e.length === 0) return undefined

  const now = Date.now()
  const items = e.map(e => {
    const position = es.nextPosition(now)
    return {
      Put: {
        TableName: es.eventsTable,
        Item: {
          slice: { S: getSlice(position) },
          key: { S: e.key },
          timestamp: { S: e.timestamp },
          position: { S: position },
          type: { S: e.type },
          data: { S: JSON.stringify(e.data) }
        },
        ConditionExpression: 'attribute_not_exists(#key) and attribute_not_exists(#position)',
        ExpressionAttributeNames: {
          '#key': 'key',
          '#position': 'position'
        }
      }
    }
  })

  // TODO: TransactWriteItems supports up to 100 items. Need strategy
  // for handling larger inputs.  Options:
  // 1. Break up into multiple transactions, return more info
  //    about which succeeded and which failed, so caller can retry
  // 2. Push limit out to caller
  const result = await es.client.send(new TransactWriteItemsCommand({
    ClientRequestToken: idempotencyKey,
    TransactItems: [
      ...items,
      {
        Put: {
          TableName: es.metadataTable,
          Item: {
            pk: { S: 'slice' },
            sk: { S: getSlice(es.nextPosition(now)) },
          }
        }
      }
    ],
    ReturnConsumedCapacity: 'TOTAL'
  }))

  return idempotencyKey && wasIdempotent(result.ConsumedCapacity ?? [])
    ? undefined
    : items[items.length - 1].Put.Item.position.S
}

export type Committed<D> = Pending<D> & {
  readonly slice: string
  readonly position: Position
}

/**
 * Read a range of all events from the event store. Range is inclusive, and omitting
 * start will read from the beginning, and ommitting end will read to end of the
 * event store.  Omit range entirely to read all events.
 */
export async function* read(es: EventStoreClient, range: Partial<Range> = {}): AsyncIterable<Committed<unknown>> {
  // TODO: Blindly calling getExtents here is inefficient
  const extents = await getExtents(es, range)
  const start = getSlice(extents.start)
  const end = getSlice(extents.end)

  for (const slice of slices(start, end)) {
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
      yield* Items.map(toEvent)
  }
}

/**
 * Read a range of events for a specific key from the event store. Range is inclusive,
 * and omitting start will read from the beginning, and ommitting end will read to
 * end of the event store.  Omit range entirely to read all events for the specified key.
 */
export async function* readKey(es: EventStoreClient, key: string, { start, end }: Partial<Range> = {}): AsyncIterable<Committed<unknown>> {
  const results = paginateQuery(es,
    {
      TableName: es.eventsTable,
      IndexName: `${es.eventsTable}-by-key-position`,
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
    yield* Items.map(toEvent)
}

/**
 * Read the most recent event for the provided key. This can be
 * useful to peek at the latest event or position for a key.
 */
export const readKeyLatest = async <K extends string>(es: EventStoreClient, key: K): Promise<Committed<unknown> | undefined> => {
  const { Items = [] } = await es.client.send(new QueryCommand({
    TableName: es.eventsTable,
    IndexName: `${es.eventsTable}-by-key-position`,
    KeyConditionExpression: '#key = :key',
    ExpressionAttributeNames: { '#key': 'key' },
    ExpressionAttributeValues: { ':key': { S: key } },
    Limit: 1,
    ScanIndexForward: false
  }))

  return Items[0] && toEvent(Items[0])
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

const toEvent = (item: Record<string, AttributeValue>): Committed<unknown> => ({
  slice: item.slice.S,
  key: item.key.S,
  type: item.type.S,
  position: item.position.S,
  timestamp: item.timestamp.S,
  data: JSON.parse(item.data.S as string)
} as Committed<unknown>)

const wasIdempotent = (consumedCapacity: readonly { readonly CapacityUnits?: number }[]): boolean =>
  0 === consumedCapacity.reduce(
    (acc, { CapacityUnits }) => acc + (CapacityUnits ?? 0), 0
  )
