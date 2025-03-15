import { DynamoDBClient, ReturnValue } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import assert from 'node:assert'
import { Committed, Notification, prefix } from '../../../src/eventstore'
import { fromConfigString } from "../../../src/eventstore/dynamodb"
import { getRevision, updateRevision } from '../../lib/revision'
import { CounterEvent } from '../domain'

assert(process.env.viewTable)
assert(process.env.eventStoreConfig)
const { viewTable, eventStoreConfig } = process.env

const client = new DynamoDBClient({})
const docClient = DynamoDBDocumentClient.from(client)
const store = fromConfigString(eventStoreConfig, client)

// Build an optimized view of counters incrementally
// from events. This allows queries to be answered simply
// by getting the answer directly from the view table.
export const handler = async ({ revision }: Notification) => {
  console.debug({ eventStoreConfig, revision })

  // Maintain latest seen event revision, so we only
  // need to read events between that and end.
  const start = await getRevision(client, viewTable)

  // Read counter events between last seen and end
  const events = store.readAll<CounterEvent>({
    start,
    startExclusive: true,
    end: revision,
    filter: { key: prefix('counter/') }
  })

  console.debug({ eventStoreConfig, start, end: revision })

  // Update the view table incrementally
  for await (const event of events) {
    console.info(event)
    await updateCounter(docClient, viewTable, event)
  }

  // Update the last seen revision, so we don't need
  // to read the same events again.
  await updateRevision(docClient, viewTable, revision)
    .catch(logConditionFailed(`Ignoring old revision update: ${revision}`))
}

export const updateCounter = (ddb: DynamoDBDocumentClient, table: string, { key, type, revision }: Committed<CounterEvent>) =>
  ddb.send(new UpdateCommand({
    TableName: table,
    Key: { pk: key },
    UpdateExpression: 'add #value :a, #increments :i, #decrements :d set #revision = :revision, #updatedAt = :updatedAt',
    ExpressionAttributeNames: {
      '#value': 'value',
      '#revision': 'revision',
      '#increments': 'increments',
      '#decrements': 'decrements',
      '#updatedAt': 'updatedAt'
    },
    ExpressionAttributeValues: {
      ':a': type === 'incremented' ? 1 : -1,
      ':i': type === 'incremented' ? 1 : 0,
      ':d': type === 'decremented' ? 1 : 0,
      ':revision': revision,
      ':updatedAt': new Date().toISOString()
    },
    ConditionExpression: 'attribute_not_exists(#revision) or #revision <= :revision',
    ReturnValues: ReturnValue.ALL_NEW
  })).then(({ Attributes }) => Attributes)
    .catch(logConditionFailed('Ignoring old event', { key, type, revision }))

const logConditionFailed = (message: string, data: Record<string, unknown> = {}) => (e: Error) => {
  if (e.name === 'ConditionalCheckFailedException')
    console.warn({ message, ...data })
  else throw e
}
