import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { APIGatewayProxyEvent } from 'aws-lambda'
import assert from 'node:assert'
import { reduce } from '../../../src/eventstore'
import { fromConfigString } from "../../../src/eventstore/dynamodb"
import { initial, update } from './behavior'
import { LeaderboardEvent } from './domain'

assert(process.env.eventStoreConfig)
const store = fromConfigString(process.env.eventStoreConfig, new DynamoDBClient({}))

export const handler = async (event: APIGatewayProxyEvent) => {
  const { id } = event.queryStringParameters ?? {}

  if (!id) return { statusCode: 400, body: 'id is required' }

  const events = store.read<LeaderboardEvent>(`leaderboard/${id}`)

  const leaderboard = await reduce(
    events,
    (leaderboard, { data }) => update(leaderboard, data),
    initial
  )

  return {
    ...leaderboard,
    competitors: leaderboard.type === 'not-started'
      ? []
      : leaderboard.competitors?.toSorted((a, b) => b.score - a.score)
  }
}
