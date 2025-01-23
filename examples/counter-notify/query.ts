import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb'
import { APIGatewayProxyEvent } from 'aws-lambda'
import { ok as assert } from 'node:assert'
import { getRevision } from './revision'

assert(process.env.viewTable)
const viewTable = process.env.viewTable
const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}))

// This Query answers the same question as the on in
// counter/query.ts.  However, it can directly get the answer
// from the view table, rather than having to rebuild it
// from all the events.
export const handler = async (event: APIGatewayProxyEvent) => {
  const { key, revision } = event.queryStringParameters ?? {}

  if (!key) return { statusCode: 400, body: 'key is required' }

  // Handle =eventual consistency
  // If the caller specific a particular revision, and we haven't
  // seen that revision yet, we can't answer the question yet.
  // Tell the caller to try again later.
  if (revision) {
    const current = await getRevision(docClient, viewTable) ?? ''
    if (current && revision > current)
      return retryAfter(current, revision, 5)
  }

  // Directly get the answer from the view table
  const { Item } = await docClient.send(new GetCommand({
    TableName: viewTable,
    Key: { pk: `counter/${key}` }
  }))

  if (!Item) return { statusCode: 404, body: `${key} not found` }

  const { pk, ...counter } = Item
  return counter
}

const retryAfter = (current: string, requested: string, retryAfterSeconds: number) => ({
  statusCode: 202,
  headers: { 'Retry-After': `${retryAfterSeconds}` },
  body: { current, requested, retryAfterSeconds }
})
