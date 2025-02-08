import { DynamoDBClient, ReturnValue } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import assert from 'node:assert'
import { fromConfig, Notification, Revision, readCategory } from '../../src/eventstore'
import { CounterEvent } from '../counter-basic/domain'
import { getRevision, updateRevision } from './revision'

assert(process.env.viewTable)

const table = process.env.viewTable
const client = new DynamoDBClient({})
const docClient = DynamoDBDocumentClient.from(client)

// Build an optimized view of counters incrementally
// from events. This allows queries to be answered simply
// by getting the answer directly from the view table.
export const handler = async ({ eventStoreConfig, end, category }: Notification) => {
  const store = fromConfig(eventStoreConfig, client)

  console.debug({ eventStoreConfig, end, category })

  // Maintain latest seen event revision, so we only
  // need to read events between that and end.
  const start = await getRevision(client, table, category)

  // Read counter events between last seen and end
  const events = readCategory<CounterEvent>(store, category, {
    start,
    startExclusive: true,
    end
  })

  console.debug({ eventStoreConfig, start, end })

  // Update the view table incrementally
  for await (const { data, ...meta } of events) {
    console.info(meta)
    await updateCounter(docClient, table, data, meta.revision)
  }

  // Update the last seen revision, so we don't need
  // to read the same events again.
  await updateRevision(docClient, table, category, end)
    .catch(logConditionFailed(`Ignoring old revision update: ${end}`))
}

export const updateCounter = (ddb: DynamoDBDocumentClient, table: string, { key, type }: CounterEvent, revision: Revision) =>
  ddb.send(new UpdateCommand({
    TableName: table,
    Key: { pk: key },
    UpdateExpression: 'add #value :a, #increments :i, #decrements :d set #revision = :revision',
    ExpressionAttributeNames: {
      '#value': 'value',
      '#revision': 'revision',
      '#increments': 'increments',
      '#decrements': 'decrements'
    },
    ExpressionAttributeValues: {
      ':a': type === 'incremented' ? 1 : -1,
      ':i': type === 'incremented' ? 1 : 0,
      ':d': type === 'decremented' ? 1 : 0,
      ':revision': revision
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
