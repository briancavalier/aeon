import { ConditionalCheckFailedException, DynamoDBClient, TransactionCanceledException } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand, TransactWriteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import assert from 'node:assert'
import { createClient, nextPosition, Notification, read } from '../../src/eventstore'
import { CompetitorAddedEvent, CompetitorScoreUpdatedEvent, LeaderboardCreatedEvent, LeaderboardEvent } from '../leaderboard/domain'
import { DisplayNameUpdatedEvent, UserProfileEvent } from '../user-profile/domain'
import { getPosition, updatePosition } from './common'

assert(process.env.viewTableName)

const table = process.env.viewTableName
const client = new DynamoDBClient({})
const docClient = DynamoDBDocumentClient.from(client)

export const handler = async ({ eventStoreName, end }: Notification) => {
  const store = createClient(eventStoreName, client)

  const start = await getPosition(docClient, table, eventStoreName)

  console.debug('Reading events', start, end)

  const events = read(store, { start: start ? nextPosition(start) : undefined, end }) //as AsyncIterable<Committed<string, string, unknown>>

  for await (const { data } of events) {
    const event = data as LeaderboardEvent | UserProfileEvent
    console.debug('Processing event', event)

    switch (event.tag) {
      case 'display-name-updated':
        await docClient.send(updateCompetitorDisplayName(table, event))
        break

      case 'created':
        await docClient.send(putLeaderboard(table, event))
          .catch(logConditionFailed('Ignoring idempotent event: Leaderboard exists', event))
        break

      case 'competitor-added':
        await docClient.send(putCompetitor(table, event))
          .catch(logConditionFailed('Ignoring idempotent event: Competitor exists', event))
        break

      case 'competitor-score-updated':
        await docClient.send(updateCompetitorScore(table, event))
          .catch(logConditionFailed('Ignoring event: Competitor not found', event))
        break
    }
  }

  await updatePosition(docClient, table, eventStoreName, end)
    .catch(e => {
      if (e.name !== 'ConditionalCheckFailedException')
        throw e
      console.debug('Skipping subscriber position update')
    })
}

const updateCompetitorDisplayName = (table: string, { tag, userId, ...data }: DisplayNameUpdatedEvent) =>
  new UpdateCommand({
    TableName: table,
    Key: {
      pk: `user/${userId}`,
      sk: 'profile'
    },
    UpdateExpression: 'set #displayName = :displayName',
    ExpressionAttributeNames: {
      '#displayName': 'displayName',
    },
    ExpressionAttributeValues: {
      ':displayName': data.displayName,
    },
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
  if (e instanceof ConditionalCheckFailedException ||
    (e instanceof TransactionCanceledException &&
      e.CancellationReasons?.every(r => r.Code === 'ConditionalCheckFailed'))
  ) return console.debug(msg, l, e)

  throw e
}
