import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { APIGatewayProxyEvent } from 'aws-lambda'
import assert from 'node:assert'
import { eq, or, prefix } from '../../../src/eventstore'
import { fromConfigString } from "../../../src/eventstore/dynamodb"
import { LeaderboardEvent } from './domain'

assert(process.env.eventStoreConfig)
const store = fromConfigString(process.env.eventStoreConfig, new DynamoDBClient({}))

type Leaderboard =
  | Readonly<{ id: string, status: 'started', startedAt: string }>
  | Readonly<{ id: string, status: 'finished', startedAt: string, finishedAt: string }>

export const handler = async (event: APIGatewayProxyEvent) => {
  const events = store.readAll<LeaderboardEvent>({
    filter: {
      key: prefix(`leaderboard/`),
      type: or(eq('started'), eq('finished'))
    }
  })

  const leaderboards = new Map<string, Leaderboard>()
  for await (const event of events) {

    switch (event.type) {
      case 'started':
        leaderboards.set(event.key, { id: parseLeaderboardId(event.key), status: 'started', startedAt: event.committedAt })
        break
      case 'finished': {
        const leaderboard = leaderboards.get(event.key)
        if (leaderboard) leaderboards.set(event.key, { ...leaderboard, status: 'finished', finishedAt: event.committedAt })
        break
      }
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify(
      [...leaderboards.values()].toSorted((a, b) => a.startedAt.localeCompare(b.startedAt))
    )
  }
}

const parseLeaderboardId = (key: string) =>
  key.split('/')[1] ?? key
