import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { APIGatewayProxyEvent } from 'aws-lambda'
import assert from 'node:assert'
import { reduce } from '../../../../src/eventstore'
import { fromConfigString } from "../../../../src/eventstore/dynamodb"
import { TransactionEvent } from '../domain'
import { initial, projectAccountSummary } from './account-summary'

assert(process.env.eventStoreConfig)
const store = fromConfigString(process.env.eventStoreConfig, new DynamoDBClient({}))

export const handler = async (event: APIGatewayProxyEvent) => {
  const { userId } = event.queryStringParameters ?? {}

  if (!userId) return { statusCode: 400, body: 'id is required' }

  const events = store.read<TransactionEvent>(`account/${userId}`)

  return reduce(
    events,
    (account, { data }) => projectAccountSummary(account, data),
    initial
  )
}
