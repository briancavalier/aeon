import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb'
import { APIGatewayProxyEvent } from 'aws-lambda'
import { ok as assert } from 'node:assert'
import { getRevision } from '../lib/revision'

assert(process.env.viewTable)
const { viewTable } = process.env

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}))

// This Query answers the same question as the one in
// counter-basic/query.ts. sHowever, it directly answers queries
// from the view table, rather than having to rebuild it
// from all the events.
export const handler = async (event: APIGatewayProxyEvent) => {
  const { name, revision } = event.queryStringParameters ?? {}

  if (!name) return { statusCode: 400, body: 'name is required' }

  // Handle eventual consistency
  // If the caller specified a particular revision, and we haven't
  // seen it yet, we can't answer the question yet. Tell the caller
  // to try again later.
  if (revision) {
    const current = await getRevision(docClient, viewTable)
    if (revision > current) return retryAfter(current, revision, 5)
  }

  // Directly get the answer from the view table
  const { Item } = await docClient.send(new GetCommand({
    TableName: viewTable,
    Key: { pk: `counter/${name}` }
  }))

  if (!Item) return { value: 0, increments: 0, decrements: 0 }

  const { pk, ...counter } = Item
  return counter
}

const retryAfter = (current: string, requested: string, retryAfterSeconds: number) => ({
  statusCode: 202,
  headers: { 'Retry-After': `${retryAfterSeconds}` },
  body: { current, requested, retryAfterSeconds }
})
