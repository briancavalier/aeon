import { AttributeValue, DynamoDBClient, paginateQuery, QueryCommand, TransactWriteItemsCommand } from '@aws-sdk/client-dynamodb'
import { monotonicFactory, } from 'ulid'
import { Position, Range } from './position'
import { getSlice, Slice, sliceEnd, slices, sliceStart } from './slice'

export interface EventStoreClient {
  readonly client: DynamoDBClient
  readonly eventsTable: string
  readonly metadataTable: string
  readonly nextPosition: (epochMilliseconds: number) => Position
}

export const eventStore = (eventsTable: string, client: DynamoDBClient, nextPosition?: (epochMilliseconds?: number) => Position): EventStoreClient => ({
  client,
  eventsTable,
  metadataTable: `${eventsTable}-metadata`,
  nextPosition: nextPosition ?? monotonicFactory() as (t: number) => Position
})

export type Pending<K, T, D> = {
  readonly key: K
  readonly type: T
  readonly timestamp: string // RFC3339 UTC datetime
  readonly data: D
}

/**
 * Append events to the event store. Provide an idempotency key to ensure
 * the events are only written once even if the same request is retried.
 */
export const append = async <const K extends string, const T extends string, const D>(es: EventStoreClient, e: readonly Pending<K, T, D>[], idempotencyKey?: string): Promise<readonly Position[]> => {
  if (e.length === 0) return []

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

  const slice = getSlice(es.nextPosition(now))

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
            slice: { S: slice },
          }
        }
      }
    ],
    ReturnConsumedCapacity: 'TOTAL'
  }))

  return (idempotencyKey && wasIdempotent(result.ConsumedCapacity ?? []))
    ? []
    : items.map(i => i.Put.Item.position.S as Position)
}

export type Committed<K, T extends string, D> = Pending<K, T, D> & {
  readonly slice: string
  readonly position: Position
}

/**
 * Read a range of all events from the event store. Range is inclusive, and omitting
 * start will read from the beginning, and ommitting end will read to end of the
 * event store.  Omit range entirely to read all events.
 */
export async function* read(es: EventStoreClient, range: Partial<Range> = {}): AsyncIterable<Committed<string, string, unknown>> {
  // TODO: Blindly calling getExtents here is inefficient
  const extents = await getExtents(es, range)
  const start = getSlice(extents.start)
  const end = getSlice(extents.end)

  console.debug('Reading slices', extents, start, end)

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
export async function* readKey<K extends string>(es: EventStoreClient, key: K, { start, end }: Partial<Range> = {}): AsyncIterable<Committed<K, string, unknown>> {
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
    yield* Items.map(toEvent<K>)
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

  const ps = start.Items?.[0]?.slice.S as Slice | undefined
  const pe = end.Items?.[0]?.slice.S as Slice | undefined

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

const toEvent = <K = string>(item: Record<string, AttributeValue>): Committed<K, string, unknown> => ({
  slice: item.slice.S,
  key: item.key.S,
  type: item.type.S,
  position: item.position.S,
  timestamp: item.timestamp.S,
  data: JSON.parse(item.data.S as string)
} as Committed<K, string, unknown>)

const wasIdempotent = (consumedCapacity: readonly { readonly CapacityUnits?: number }[]): boolean =>
  0 === consumedCapacity.reduce(
    (acc, { CapacityUnits }) => acc + (CapacityUnits ?? 0), 0
  )
