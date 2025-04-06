import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { APIGatewayProxyEvent } from 'aws-lambda'
import assert from 'node:assert'
import { reduce } from '../../../src/eventstore'
import { fromConfigString } from "../../../src/eventstore/dynamodb"
import { LeaderboardCommand, decide, initial, update } from './behavior'
import { LeaderboardEvent } from './domain'

assert(process.env.eventStoreConfig)

const client = new DynamoDBClient({})
const store = fromConfigString(process.env.eventStoreConfig, client)

export const handler = async (event: APIGatewayProxyEvent) => {
  const command = JSON.parse(event.body ?? '') as LeaderboardCommand
  const correlationId = event.headers['x-correlation-id'] ?? event.requestContext.requestId

  const key = `leaderboard/${command.id}`
  const revision = await store.head(key)
  const history = store.read<LeaderboardEvent>(key)

  const leaderboard = await reduce(
    history,
    (leaderboard, { data }) => update(leaderboard, data),
    initial
  )

  const events = decide(leaderboard, command)

  return store.append(
    key,
    events.map(data => ({ type: data.type, correlationId, data })),
    { expectedRevision: revision }
  )

}
