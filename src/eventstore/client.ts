import { AttributeValue, DynamoDBClient, GetItemCommand, paginateQuery, TransactWriteItemsCommand } from '@aws-sdk/client-dynamodb'
import { ok as assert } from 'node:assert'
import { monotonicFactory, } from 'ulid'
import { end, ensureInclusive, InclusiveRange, Revision, RangeInput, start } from './revision'
import { getSlice, Slice } from './slice'
import { marshall, NativeAttributeValue, unmarshall } from '@aws-sdk/util-dynamodb'
import { Pending, Committed } from './event'
import { paginate } from './dynamodb/paginate'
import { Filter } from './filter'
import { DynamoDBExpression, toFilterExpression } from './dynamodb/filter-expression'

export interface EventStoreClient {
  readonly name: string
  readonly eventsTable: string
  readonly metadataTable: string
  readonly revisionIndex: string
  readonly client: DynamoDBClient
  readonly nextRevision: (epochMilliseconds: number) => Revision
}

export type EventStoreConfig = {
  readonly name: string,
  readonly eventsTable: string
  readonly metadataTable: string
  readonly revisionIndex: string
}

export const fromConfig = (config: EventStoreConfig, client: DynamoDBClient, nextRevision?: (epochMilliseconds?: number) => Revision): EventStoreClient => ({
  ...config,
  client,
  nextRevision: nextRevision ?? monotonicFactory() as (t: number) => Revision
})

export const fromConfigString = (configString: string, client: DynamoDBClient, nextRevision?: (epochMilliseconds?: number) => Revision): EventStoreClient =>
  fromConfig(parseConfig(configString), client, nextRevision)

export const parseConfig = (configString: string): EventStoreConfig => {
  try {
    const config = JSON.parse(configString)
    assert(typeof config === 'object', 'config must be an object')
    assert(typeof config.name === 'string', 'name must be a string')
    assert(typeof config.eventsTable === 'string', 'eventsTable must be a string')
    assert(typeof config.metadataTable === 'string', 'metadataTable must be a string')
    assert(typeof config.revisionIndex === 'string', 'revisionIndex must be a string')
    return config
  } catch (e) {
    throw new Error(`Invalid configString: ${configString}`, { cause: e })
  }
}

export type AppendResult =
  | Readonly<{ type: 'unchanged' }>
  | Readonly<{ type: 'appended', count: number, revision: Revision }>
  | Readonly<{ type: 'aborted/optimistic-concurrency', error: Error }>
  | Readonly<{ type: 'aborted/unknown', error: unknown }>

export type AppendKeyOptions = Readonly<{
  expectedRevision?: Revision,
  idempotencyKey?: string
}>

/**
 * Append events to the event store. Provide an idempotency key to ensure
 * the events are only written once even if the same request is retried.
 */
export const append = async <const D extends NativeAttributeValue>(es: EventStoreClient, key: string, events: readonly Pending<D>[], {
  expectedRevision = end,
  idempotencyKey
}: AppendKeyOptions = {}
): Promise<AppendResult> => {
  if (events.length === 0) return { type: 'unchanged' }

  const now = Date.now()
  const committedAt = new Date(now).toISOString()
  const items = events.map(e => {
    const revision = es.nextRevision(now)
    return {
      Put: {
        TableName: es.eventsTable,
        Item: {
          slice: { S: getSlice(revision) },
          key: { S: key },
          committedAt: { S: committedAt },
          correlationId: e.correlationId ? { S: e.correlationId } : { NULL: true },
          revision: { S: revision },
          type: { S: e.type },
          data: { M: marshall(e.data, { removeUndefinedValues: true }) }
        },
        ConditionExpression: 'attribute_not_exists(#key)',
        ExpressionAttributeNames: { '#key': 'key' }
      }
    }
  })

  const newRevision = items[items.length - 1].Put.Item.revision.S
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
              sk: { S: 'head' },
              revision: { S: newRevision }
            },
            ...expectedRevision === end ? {}
              : expectedRevision === start ? {
                ConditionExpression: 'attribute_not_exists(#revision)',
                ExpressionAttributeNames: { '#revision': 'revision' },
              } : {
                ConditionExpression: '#revision = :expectedRevision',
                ExpressionAttributeNames: { '#revision': 'revision' },
                ExpressionAttributeValues: { ':expectedRevision': { S: expectedRevision } }
              }
          }
        },
        {
          Put: {
            TableName: es.metadataTable,
            Item: {
              pk: { S: 'slice' },
              sk: { S: items[0].Put.Item.slice.S },
            }
          }
        },
        ...items,
      ]
    }))

    return idempotencyKey && wasIdempotent(result.ConsumedCapacity ?? [])
      ? { type: 'unchanged' }
      : { type: 'appended', count: items.length, revision: newRevision }
  } catch (e) {
    return mapTransactionError(e)
  }
}

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
      const results = paginate(es.client, range.limit, buildQuery(es.eventsTable, 'slice', slice, range, f, es.revisionIndex))

      for await (const item of results) yield toEvent<A>(item)
    }
  }
}

/**
 * Get the {@link Revision} of the latest event for a specific key.
 * If the key has no events, the returned {@link Revision} will be
 * the start of time.
 */
export const head = async (es: EventStoreClient, key: string): Promise<Revision> =>
  es.client.send(new GetItemCommand({
    TableName: es.metadataTable,
    // Are there any reasons to use ConsistentRead: true?
    Key: { pk: { S: key }, sk: { S: 'head' } }
  })).then(({ Item }) => Item?.revision.S as Revision ?? start)

/**
 * Read a range of events for a specific key from the event store. Range is inclusive,
 * and omitting start will read from the beginning, and ommitting end will read to
 * end of the event store.  Omit range entirely to read all events for the specified key.
 */
export async function* read<A>(es: EventStoreClient, key: string, { filter, ...r }: ReadInput = {}): AsyncIterable<Committed<A>> {
  const range = ensureInclusive(r)

  if (range.start && range.end && range.start > range.end) return

  const f = filter ? toFilterExpression(filter) : {}

  const results = paginate(es.client, range.limit, buildQuery(es.eventsTable, 'key', key, range, f))

  for await (const item of results) yield toEvent<A>(item)
}

const buildQuery = (tableName: string, keyName: string, keyValue: string, range: InclusiveRange, f: DynamoDBExpression = {}, indexName?: string) => ({
  TableName: tableName,
  IndexName: indexName,
  KeyConditionExpression: '#key = :key AND #revision between :start AND :end',
  FilterExpression: f.FilterExpression,
  ExpressionAttributeNames: {
    ...f.ExpressionAttributeNames,
    '#key': keyName,
    '#revision': 'revision'
  },
  ExpressionAttributeValues: {
    ...f.ExpressionAttributeValues,
    ':key': { S: keyValue },
    ':start': { S: range.start },
    ':end': { S: range.end }
  },
  Limit: range.limit,
  ScanIndexForward: range.direction === 'forward'
})

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
  revision: item.revision.S,
  correlationId: item.correlationId.S,
  committedAt: item.committedAt.S,
  data: item.data?.M && unmarshall(item.data.M)
} as Committed<A>)

const wasIdempotent = (consumedCapacity: readonly { readonly CapacityUnits?: number }[]): boolean =>
  0 === consumedCapacity.reduce(
    (acc, { CapacityUnits }) => acc + (CapacityUnits ?? 0), 0
  )

const mapTransactionError = (e: unknown): AppendResult =>
  (e instanceof Error && e.name === 'TransactionCanceledException')
    ? { type: 'aborted/optimistic-concurrency', error: e }
    : { type: 'aborted/unknown', error: e }
