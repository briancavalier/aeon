import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { APIGatewayProxyEvent } from 'aws-lambda'
import assert from 'node:assert'
import { createClient } from '../../src/eventstore'
import { handleCommand } from '../lib/handle-command'
import { decide, update, UserProfileCommand } from './command'

assert(process.env.eventStoreName)

const client = new DynamoDBClient({})
const store = createClient(process.env.eventStoreName, client)

const handleUserProfileCommand = handleCommand(decide, update, undefined)

export const handler = async (event: APIGatewayProxyEvent) => {
  const c = JSON.parse(event.body ?? '') as UserProfileCommand

  const body = await handleUserProfileCommand(store, {
    key: c.userId,
    type: c.type,
    data: c
  }, event.queryStringParameters?.idempotencyKey)

  return { statusCode: 202, body }
}
