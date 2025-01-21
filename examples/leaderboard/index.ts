import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { APIGatewayProxyEvent } from 'aws-lambda'
import assert from 'node:assert'
import { append, createClient, readKey } from '../../src/eventstore'
import { decide, LeaderboardCommand, update } from './command'
import { LeaderboardEvent } from './domain'

assert(process.env.eventStoreName)

const client = new DynamoDBClient({})
const store = createClient(process.env.eventStoreName, client)

export const handler = async (event: APIGatewayProxyEvent) => {
  const c = JSON.parse(event.body ?? '') as LeaderboardCommand
  const history = readKey(store, c.id)

  let leaderboard = undefined
  for await (const event of history)
    leaderboard = update(leaderboard, event.data as LeaderboardEvent)

  const events = decide(leaderboard, c)

  const timestamp = new Date().toISOString()
  return append(store, events.map(e => ({ key: e.id, type: e.tag, timestamp, data: e })))
}
