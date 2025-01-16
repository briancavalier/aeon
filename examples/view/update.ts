import { ConditionalCheckFailedException, DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand, TransactWriteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import assert from 'node:assert'
import { CompetitorAddedEvent, CompetitorScoreUpdatedEvent, LeaderboardCreatedEvent, LeaderboardEvent } from '../domain'
import { subscriber } from './subscriber'

assert(process.env.viewTableName)

const table = process.env.viewTableName
const client = new DynamoDBClient({})
const docClient = DynamoDBDocumentClient.from(client)

export const handler = subscriber(table, client, async (event) => {
  const data = event as LeaderboardEvent
  switch (data.tag) {
    case 'created': {
      await docClient.send(putLeaderboard(table, data))
        .catch(logConditionFailed('Ignoring idempotent event: Leaderboard exists', data))

      break
    }

    case 'competitor-added': {
      await docClient.send(putCompetitor(table, data))
        .catch(logConditionFailed('Ignoring idempotent event: Competitor exists', data))

      break
    }

    case 'competitor-score-updated': {
      await docClient.send(updateCompetitorScore(table, data))
        .catch(logConditionFailed('Ignoring event: Competitor not found', data))

      break
    }
  }
})

const putLeaderboard = (table: string, { tag, id, ...data }: LeaderboardCreatedEvent) =>
  new PutCommand({
    TableName: table,
    Item: {
      pk: `leaderboard/${id}`,
      sk: 'leaderboard',
      leaderboardId: id,
      ...data,
    },
    ConditionExpression: 'attribute_not_exists(pk)'
  })

const putCompetitor = (table: string, { tag, id, ...data }: CompetitorAddedEvent) =>
  new TransactWriteCommand({
    TransactItems: [
      {
        Put: {
          TableName: table,
          Item: {
            pk: `leaderboard/${id}`,
            sk: `user/${data.userId}`,
            leaderboardId: id,
            ...data
          },
          ConditionExpression: 'attribute_not_exists(pk)'
        }
      },
      {
        Put: {
          TableName: table,
          Item: {
            pk: `user/${data.userId}`,
            sk: `leaderboard/${id}`,
            leaderboardId: id,
            userId: data.userId,
          },
          ConditionExpression: 'attribute_not_exists(pk)'
        }
      }
    ]
  })

const updateCompetitorScore = (table: string, data: CompetitorScoreUpdatedEvent) =>
  new UpdateCommand({
    TableName: table,
    Key: {
      pk: `leaderboard/${data.id}`,
      sk: `user/${data.userId}`,
    },
    UpdateExpression: 'set #score = :score',
    ExpressionAttributeNames: {
      '#score': 'score',
    },
    ExpressionAttributeValues: {
      ':score': data.score,
    },
    ConditionExpression: 'attribute_exists(pk)',
  })

const logConditionFailed = (msg: string, l: LeaderboardEvent) => (e: Error) => {
  if (e instanceof ConditionalCheckFailedException)
    return console.debug(msg, e)
  throw e
}
