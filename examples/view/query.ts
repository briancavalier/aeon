import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { BatchGetCommand, DynamoDBDocumentClient, paginateQuery, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { APIGatewayProxyEvent } from 'aws-lambda'
import assert from 'node:assert'
import { Id } from '../domain'
import { getCurrentRevision } from './revision'

assert(process.env.viewTableName)

const table = process.env.viewTableName
const client = new DynamoDBClient({})
const docClient = DynamoDBDocumentClient.from(client)

export const handler = async (event: APIGatewayProxyEvent) => {
  const { leaderboardId, userId, revision } = event.queryStringParameters ?? {}

  const current = await getCurrentRevision(client, table) ?? ''

  if (revision && revision > current)
    return retryAfter(current, revision, 5)

  if (leaderboardId)
    return (await getLeaderboard(leaderboardId)) ?? { statusCode: 404, body: '' }

  if (userId)
    return getUserLeaderboards(userId)

  return { statusCode: 400, body: '' }
}

const retryAfter = (current: string, requested: string, retryAfterSeconds: number) => ({
  statusCode: 202,
  headers: { 'Retry-After': `${retryAfterSeconds}` },
  body: JSON.stringify({ current, requested, retryAfterSeconds })
})

type Leaderboard = Readonly<{
  id: Id<'Leaderboard'>,
  name: string,
  description: string,
  competitors: readonly Competitor[]
}>

type Competitor = Readonly<{
  id: Id<'User'>,
  score: number,
}>

const getLeaderboard = async (leaderboardId: string): Promise<Leaderboard | undefined> => {
  const results = paginateQuery({ client: docClient }, {
    TableName: table,
    KeyConditionExpression: '#pk = :pk',
    ExpressionAttributeNames: { '#pk': 'pk' },
    ExpressionAttributeValues: {
      ':pk': `leaderboard/${leaderboardId}`
    },
  })

  let leaderboard = {} as Leaderboard

  for await (const r of results) {
    for (const item of r?.Items ?? []) {
      if (item.sk === 'leaderboard')
        leaderboard = {
          ...leaderboard,
          id: item.leaderboardId,
          name: item.name,
          description: item.description,
        } as Leaderboard
      else
        leaderboard = {
          ...leaderboard,
          competitors: [
            ...(leaderboard.competitors ?? []),
            {
              id: item.userId,
              score: +(item.score ?? 0),
            }
          ]
        } as Leaderboard
    }
  }

  return leaderboard.id ? {
    ...leaderboard,
    competitors: leaderboard.competitors?.toSorted(byScoreDescending) ?? []
  } : undefined
}

const byScoreDescending = (c1: Competitor, c2: Competitor) => c2.score - c1.score

type UserLeaderboard = Readonly<{
  id: Id<'Leaderboard'>,
  name: string,
  description: string
}>

const getUserLeaderboards = async (userId: string): Promise<readonly UserLeaderboard[]> => {
  const result = await docClient.send(new QueryCommand({
    TableName: table,
    KeyConditionExpression: '#pk = :pk',
    ExpressionAttributeNames: {
      '#pk': 'pk'
    },
    ExpressionAttributeValues: {
      ':pk': `user/${userId}`
    }
  }))

  const leaderboards = await docClient.send(new BatchGetCommand({
    RequestItems: {
      [table]: {
        Keys: result.Items?.map(i => ({
          pk: `leaderboard/${i.leaderboardId.S}`,
          sk: 'leaderboard'
        }))
      }
    }
  }))

  return leaderboards.Responses?.[table]
    .map(l => ({
      id: l.leaderboardId,
      name: l.name,
      description: l.description,
    } as UserLeaderboard)) ?? []
}
