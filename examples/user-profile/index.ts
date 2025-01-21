import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { APIGatewayProxyEvent } from 'aws-lambda'
import assert from 'node:assert'
import { append, createClient, readKey } from '../../src/eventstore'
import { decide, update, UserProfileCommand } from './command'
import { UserProfileEvent } from './domain'

assert(process.env.eventStoreName)

const client = new DynamoDBClient({})
const store = createClient(process.env.eventStoreName, client)

export const handler = async (event: APIGatewayProxyEvent) => {
  const c = JSON.parse(event.body ?? '') as UserProfileCommand
  const history = readKey(store, c.userId)

  let userProfile = undefined
  for await (const event of history)
    userProfile = update(userProfile, event.data as UserProfileEvent)

  const events = decide(userProfile, c)
  console.log('events', process.env.eventStoreName, events)

  const timestamp = new Date().toISOString()
  return append(store, events.map(e => ({ key: e.userId, type: e.tag, timestamp, data: e })))
}
