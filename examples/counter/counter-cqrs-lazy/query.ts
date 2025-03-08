import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb'
import { APIGatewayProxyEvent } from 'aws-lambda'
import { ok as assert } from 'node:assert'
import { Revision, reduce, start } from '../../../src/eventstore'
import { fromConfigString } from '../../../src/eventstore/dynamodb'
import { CounterEvent } from '../domain'

assert(process.env.viewTable)
assert(process.env.eventStoreConfig)

const { viewTable, eventStoreConfig } = process.env

const client = new DynamoDBClient({})
const store = fromConfigString(eventStoreConfig, client)
const docClient = DynamoDBDocumentClient.from(client)

type Counter = Readonly<{
  name: string
  value: number
  increments: number
  decrements: number
  revision: Revision
}>

const zeroCounter = { value: 0, increments: 0, decrements: 0, revision: start }

// This Query answers the same question as the one in
// counter-basic/query.ts. However, it uses a read-through
// strategy to build an optimized view lazily and incrementally
// from new events, rather than having to rebuild it from all
// the events each time.
export const handler = async (event: APIGatewayProxyEvent) => {
  const { name, revision } = event.queryStringParameters ?? {}

  if (!name) return { statusCode: 400, body: 'name is required' }

  // Get the current view state of the counter
  const counter = await getCounter(docClient, viewTable, name)

  console.debug({ name, revision, counter })

  // Read all the events since the revision of the current view state
  const events = store.read<CounterEvent>(`counter/${name}`, {
    start: counter.revision,
    startExclusive: true,
  })

  // Update the view state by applying all the events
  const updated = await reduce(events, (counter, { data, revision }) => {
    switch (data.type) {
      case 'incremented':
        return { ...counter, value: counter.value + 1, increments: counter.increments + 1, revision }
      case 'decremented':
        return { ...counter, value: counter.value - 1, decrements: counter.decrements + 1, revision }
    }
  }, counter)

  console.debug({ name, revision, counter, updated, events })

  // Persist the updated view state
  await updateCounter(docClient, viewTable, updated)

  // If the caller requested a revision we still haven't seen,
  // we can't answer the question yet. Tell the caller to try again later.
  if (revision && revision > updated.revision)
    return retryAfter(updated.revision, revision, 5)

  return updated
}

const retryAfter = (current: string, requested: string, retryAfterSeconds: number) => ({
  statusCode: 202,
  headers: { 'Retry-After': `${retryAfterSeconds}` },
  body: { current, requested, retryAfterSeconds }
})

const getCounter = async (docClient: DynamoDBDocumentClient, viewTable: string, name: string): Promise<Counter> => {
  const { Item } = await docClient.send(new GetCommand({
    TableName: viewTable,
    Key: { pk: `counter/${name}` }
  }))

  if (!Item) return { name, ...zeroCounter }

  const { pk, ...counter } = Item
  return counter as Counter
}

const updateCounter = (ddb: DynamoDBDocumentClient, table: string, { name, value, increments, decrements, revision }: Counter) =>
  ddb.send(new PutCommand({
    TableName: table,
    Item: { pk: `counter/${name}`, name, value, increments, decrements, revision },
    ConditionExpression: 'attribute_not_exists(pk) or #revision <= :revision',
    ExpressionAttributeNames: { '#revision': 'revision' },
    ExpressionAttributeValues: { ':revision': revision }
  }))
