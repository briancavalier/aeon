import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { BatchGetCommand, DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { APIGatewayProxyEvent } from 'aws-lambda'
import assert from 'node:assert'
import { Id } from '../lib/id'
import { hasSeenRevision, Revision } from '../lib/revision'
import { getRevision } from './revision'

assert(process.env.viewTableName)

const table = process.env.viewTableName
const client = new DynamoDBClient({})
const docClient = DynamoDBDocumentClient.from(client)

export const handler = async (event: APIGatewayProxyEvent) => {
  const query = event.queryStringParameters ?? {}
  console.info(query)

  const { revision, leaderboardId, userId } = query

  const requested = parseRevision(revision)
  const current = await getRevision(client, table)

  if (!hasSeenRevision(current, requested))
    return retryAfter(current, requested, 5)

  if (leaderboardId) {
    const leaderboard = await getLeaderboard(leaderboardId)
    return leaderboard ?? { statusCode: 404, body: '' }
  }

  if (userId)
    return getUserLeaderboards(userId)

  return { statusCode: 400, body: '' }
}

const parseRevision = (revision: string | undefined): Revision =>
  revision ? JSON.parse(revision) : {}

const retryAfter = (current: Revision, requested: Revision, retryAfterSeconds: number) => ({
  statusCode: 202,
  headers: { 'Retry-After': `${retryAfterSeconds}` },
  body: { current, requested, retryAfterSeconds }
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
  displayName: string
}>

const byScoreDescending = (c1: Competitor, c2: Competitor) => c2.score - c1.score

const getLeaderboard = async (leaderboardId: string): Promise<Leaderboard | undefined> => {
  const { Items = [] } = await docClient.send(new QueryCommand({
    TableName: table,
    KeyConditionExpression: '#pk = :pk',
    ExpressionAttributeNames: { '#pk': 'pk' },
    ExpressionAttributeValues: {
      ':pk': `leaderboard/${leaderboardId}`
    },
  }))

  if (Items.length === 0) return undefined

  let leaderboard = {} as Leaderboard
  let competitors = [] as Competitor[]

  for (const item of Items) {
    if (item.sk === 'leaderboard')
      leaderboard = {
        ...leaderboard,
        id: item.leaderboardId,
        name: item.name,
        description: item.description,
      }
    else
      competitors = [
        ...competitors,
        {
          id: item.userId,
          score: +(item.score ?? 0),
          displayName: ''
        }
      ]
  }

  if (competitors.length === 0)
    return { ...leaderboard, competitors }

  const profiles = await getUserProfiles(competitors)

  leaderboard = {
    ...leaderboard,
    competitors: competitors.map((competitor, i) => ({
      ...competitor,
      displayName: profiles[i]?.displayName ?? ''
    }))
  }

  return leaderboard.id ? {
    ...leaderboard,
    competitors: leaderboard.competitors.toSorted(byScoreDescending)
  } : undefined
}

const getUserProfiles = (competitors: readonly Competitor[]) =>
  docClient.send(new BatchGetCommand({
    RequestItems: {
      [table]: {
        Keys: competitors.map(({ id }) => ({
          pk: `user/${id}`,
          sk: 'profile'
        }))
      }
    }
  })).then(({ Responses }) => Responses?.[table] ?? [])


type UserLeaderboard = Readonly<{
  id: Id<'Leaderboard'>,
  name: string,
  description: string
}>

const getUserLeaderboards = async (userId: string): Promise<readonly UserLeaderboard[]> => {
  const { Items = [] } = await docClient.send(new QueryCommand({
    TableName: table,
    KeyConditionExpression: '#pk = :pk',
    ExpressionAttributeNames: {
      '#pk': 'pk'
    },
    ExpressionAttributeValues: {
      ':pk': `user/${userId}`
    }
  }))

  if (Items.length === 0) return []

  const { Responses = {} } = await docClient.send(new BatchGetCommand({
    RequestItems: {
      [table]: {
        Keys: Items?.map(i => ({
          pk: `leaderboard/${i.leaderboardId}`,
          sk: 'leaderboard'
        }))
      }
    }
  }))

  return Responses?.[table]?.map(l => ({
    id: l.leaderboardId,
    name: l.name,
    description: l.description,
  } as UserLeaderboard)) ?? []
}
