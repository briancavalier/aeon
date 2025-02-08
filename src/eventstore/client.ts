import { AttributeValue, DynamoDBClient, GetItemCommand, TransactWriteItemsCommand } from '@aws-sdk/client-dynamodb'
import { ok as assert } from 'node:assert'
import { monotonicFactory, } from 'ulid'
import { end, ensureInclusive, Revision, RangeInput, start } from './revision'
import { marshall, NativeAttributeValue, unmarshall } from '@aws-sdk/util-dynamodb'
import { Pending, Committed } from './event'
import { paginate } from './dynamodb/paginate'

export interface EventStoreClient {
  readonly name: string
  readonly eventsTable: string
  readonly metadataTable: string
  readonly categoryIndex: string
  readonly client: DynamoDBClient
  readonly nextRevision: (epochMilliseconds: number) => Revision
}

export type EventStoreConfig = {
  readonly name: string,
  readonly eventsTable: string
  readonly metadataTable: string
  readonly categoryIndex: string
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
    assert(typeof config.categoryIndex === 'string', 'categoryIndex must be a string')
    return config
  } catch (e) {
    throw e
    // throw new Error(`Invalid configString: ${configString}`, { cause: e })
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
    const item: Record<string, AttributeValue> = {
      key: { S: key },
      revision: { S: revision },
      committedAt: { S: committedAt },
      type: { S: e.type },
      data: { M: marshall(e.data) }
    }

    if(e.category) item.category = { S: e.category }
    if(e.correlationId) item.correlationId = { S: e.correlationId }

    return {
      Put: {
        TableName: es.eventsTable,
        Item: item,
        ConditionExpression: 'attribute_not_exists(#key)',
        ExpressionAttributeNames: { '#key': 'key' }
      }
    }
  })

  const newRevision = items[items.length - 1].Put.Item.revision.S as Revision
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

const mapTransactionError = (e: unknown): AppendResult =>
  (e instanceof Error && e.name === 'TransactionCanceledException')
    ? { type: 'aborted/optimistic-concurrency', error: e }
    : { type: 'aborted/unknown', error: e }

/**
 * Get the {@link Revision} of the latest event for a specific key.
 * If the key has no events, the returned {@link Revision} will be
 * the start of time.
 */
export const head = async (es: EventStoreClient, key: string): Promise<Revision> =>
  es.client.send(new GetItemCommand({
    TableName: es.metadataTable,
    // Are there any reasons to use ConsistentRead: true?
    Key: { pk: { S: key }, sk: { S: 'state' } }
  })).then(({ Item }) => Item?.revision.S as Revision)

/**
 * Read a range of events for a specific key from the event store. Range is inclusive,
 * and omitting start will read from the beginning, and ommitting end will read to
 * end of the event store.  Omit range entirely to read all events for the specified key.
 */
export async function* read<A>(es: EventStoreClient, key: string, r: RangeInput = {}): AsyncIterable<Committed<A>> {
  const range = ensureInclusive(r)

  if (range.start && range.end && range.start > range.end) return

  const results = paginate(es.client, range.limit,
    {
      TableName: es.eventsTable,
      KeyConditionExpression: `#key = :key ${start && end ? 'AND #revision between :start AND :end'
        : start ? 'AND #revision >= :start'
          : end ? 'AND #revision <= :end'
            : ''}`,
      ExpressionAttributeNames: {
        '#key': 'key',
        ...((start || end) && { '#revision': 'revision' })
      },
      ExpressionAttributeValues: {
        ':key': { S: key },
        ...(start && { ':start': { S: start } }),
        ...(end && { ':end': { S: end } })
      },
      ScanIndexForward: r.direction === 'forward'
    })

  for await (const item of results) yield toEvent<A>(item)
}

/**
 * Read a range of events for a specific key from the event store. Range is inclusive,
 * and omitting start will read from the beginning, and ommitting end will read to
 * end of the event store.  Omit range entirely to read all events for the specified key.
 */
export async function* readCategory<A>(es: EventStoreClient, category: string, r: RangeInput = {}): AsyncIterable<Committed<A>> {
  const range = ensureInclusive(r)

  if (range.start && range.end && range.start > range.end) return

  const results = paginate(es.client, range.limit,
    {
      TableName: es.eventsTable,
      IndexName: es.categoryIndex,
      KeyConditionExpression: `#category = :category ${start && end ? 'AND #revision between :start AND :end'
        : start ? 'AND #revision >= :start'
          : end ? 'AND #revision <= :end'
            : ''}`,
      ExpressionAttributeNames: {
        '#category': 'category',
        ...((start || end) && { '#revision': 'revision' })
      },
      ExpressionAttributeValues: {
        ':category': { S: category },
        ...(start && { ':start': { S: start } }),
        ...(end && { ':end': { S: end } })
      },
      ScanIndexForward: r.direction === 'forward'
    })

  for await (const item of results) yield toEvent<A>(item)
}

const toEvent = <A>(item: Record<string, AttributeValue>): Committed<A> => ({
  key: item.key.S,
  type: item.type.S,
  category: item.category?.S,
  revision: item.revision.S,
  correlationId: item.correlationId?.S,
  committedAt: item.committedAt.S,
  data: item.data?.M && unmarshall(item.data.M)
} as Committed<A>)

const wasIdempotent = (consumedCapacity: readonly { readonly CapacityUnits?: number }[]): boolean =>
  0 === consumedCapacity.reduce(
    (acc, { CapacityUnits }) => acc + (CapacityUnits ?? 0), 0
  )
