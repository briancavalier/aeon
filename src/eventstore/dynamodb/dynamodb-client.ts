import { AttributeValue, DynamoDBClient, GetItemCommand, TransactWriteItemsCommand, TransactionCanceledException, paginateQuery } from "@aws-sdk/client-dynamodb"
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb'
import { ok as assert } from "node:assert/strict"
import { monotonicFactory } from "ulid"
import { AppendOptions, AppendResult, Committed, EventStoreClient, Pending, ReadOptions } from '../event-store-client'
import { InclusiveRange, Revision, end, ensureInclusive, start } from "../revision"
import { DynamoDBExpression, toFilterExpression } from "./filter-expression"
import { paginate } from "./paginate"

export class DynamoDBEventStoreClient<Event extends Readonly<Record<string, unknown>> = Readonly<Record<string, unknown>>> implements EventStoreClient<Event> {
  constructor(
    public readonly name: string,
    public readonly eventsTable: string,
    public readonly metadataTable: string,
    public readonly revisionIndex: string,
    public readonly client: DynamoDBClient,
    public readonly nextRevision: (epochMilliseconds: number) => Revision
  ) { }

  static fromConfig({ name, eventsTable, metadataTable, revisionIndex }: EventStoreConfig, client: DynamoDBClient, nextRevision?: (epochMilliseconds?: number) => Revision): DynamoDBEventStoreClient {
    return new DynamoDBEventStoreClient(name, eventsTable, metadataTable, revisionIndex, client, nextRevision ?? monotonicFactory() as (t: number) => Revision)
  }

  static fromConfigString(configString: string, client: DynamoDBClient, nextRevision?: (epochMilliseconds?: number) => Revision): DynamoDBEventStoreClient {
    return DynamoDBEventStoreClient.fromConfig(parseConfig(configString), client, nextRevision)
  }

  async append<E extends Event>(key: string, events: readonly Pending<E>[], { idempotencyKey, expectedRevision = end }: AppendOptions = {}): Promise<AppendResult> {
    if (events.length === 0) return { type: 'unchanged' }

    const now = Date.now()
    const items = events.map(e =>
      putEvent(this.eventsTable, key, new Date(now).toISOString(), e, this.nextRevision(now)))

    const newRevision = items[items.length - 1].Put.Item.revision.S
    try {
      const result = await this.client.send(new TransactWriteItemsCommand({
        ClientRequestToken: idempotencyKey,
        ReturnConsumedCapacity: 'TOTAL',
        TransactItems: [
          {
            Put: {
              TableName: this.metadataTable,
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
              TableName: this.metadataTable,
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
      return mapTransactionError(e, expectedRevision)
    }
  }

  async head(key: string): Promise<Revision> {
    return this.client.send(new GetItemCommand({
      TableName: this.metadataTable,
      // Are there any reasons to use ConsistentRead: true?
      Key: { pk: { S: key }, sk: { S: 'head' } }
    })).then(({ Item }) => Item?.revision.S as Revision ?? start)
  }

  async *read<E extends Event>(key: string, { filter, ...r }: ReadOptions = {}): AsyncIterable<Committed<E>> {
    const range = ensureInclusive(r)
    if (range.start && range.end && range.start > range.end) return

    const f = filter ? toFilterExpression(filter) : {}

    const results = paginate(this.client, range.limit, queryEvents(this.eventsTable, 'key', key, range, f))

    for await (const item of results) yield toEvent<E>(item)
  }

  async *readAll<E extends Event>({ filter, ...r }: ReadOptions = {}): AsyncIterable<Committed<E>> {
    const range = ensureInclusive(r)
    if (range.limit <= 0 || range.start > range.end) return

    const f = filter ? toFilterExpression(filter) : {}

    const slices = getSlices(this.client, this.metadataTable, range)

    for await (const page of slices) {
      for (const slice of page) {
        const results = paginate(this.client, range.limit, queryEvents(this.eventsTable, 'slice', slice, range, f, this.revisionIndex))

        for await (const item of results) yield toEvent<E>(item)
      }
    }
  }
}

export type EventStoreConfig = {
  readonly name: string,
  readonly eventsTable: string
  readonly metadataTable: string
  readonly revisionIndex: string
}

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

const putEvent = <E>(table: string, key: string, committedAt: string, e: Pending<E>, revision: Revision) => ({
  Put: {
    TableName: table,
    Item: {
      slice: { S: getSlice(revision) },
      key: { S: key },
      committedAt: { S: committedAt },
      correlationId: e.correlationId ? { S: e.correlationId } : { NULL: true },
      revision: { S: revision },
      type: { S: e.type },
      data: { M: marshall(e.data, { removeUndefinedValues: true }) }
    }
  }
})

const queryEvents = (tableName: string, keyName: string, keyValue: string, range: InclusiveRange, f: DynamoDBExpression = {}, indexName?: string) => ({
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

type Slice = string & { readonly type: 'Slice' }

const sliceLen = 5

const getSlice = (p: Revision): Slice =>
  p.slice(0, sliceLen) as Slice

async function* getSlices(client: DynamoDBClient, table: string, range: InclusiveRange): AsyncIterable<readonly Slice[]> {
  const pages = paginateQuery({ client }, {
    TableName: table,
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

const mapTransactionError = (e: unknown, expectedRevision: Revision): AppendResult => {
  if (e instanceof TransactionCanceledException && e.CancellationReasons?.[0]?.Code === 'ConditionalCheckFailed')
    return { type: 'aborted/optimistic-concurrency', error: e, expectedRevision }

  return { type: 'aborted/unknown', error: e }
}
