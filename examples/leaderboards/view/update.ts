import { ConditionalCheckFailedException, DynamoDBClient, TransactionCanceledException } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand, TransactWriteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import assert from 'node:assert'
import { fromConfig, Notification } from '../../../src/eventstore'
import { CompetitorAddedEvent, CompetitorScoreUpdatedEvent, LeaderboardCreatedEvent, LeaderboardEvent } from '../leaderboard/domain'
import { DisplayNameUpdatedEvent, UserProfileEvent } from '../user-profile/domain'
import { getRevision, readAfterRevision, updateRevision } from './revision'

assert(process.env.viewTableName)

const table = process.env.viewTableName
const client = new DynamoDBClient({})
const docClient = DynamoDBDocumentClient.from(client)

export const handler = async ({ eventStoreConfig, end }: Notification) => {
  const store = fromConfig(eventStoreConfig, client)

  const revision = await getRevision(client, table)

  const events = await readAfterRevision(store, revision, end)
  console.debug({ eventStoreConfig, end, revision, events })

  for await (const { data, ...meta } of events) {
    const event = data as LeaderboardEvent | UserProfileEvent
    console.info(meta)

    switch (event.type) {
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

  await updateRevision(docClient, table, { ...revision, [store.name]: end })
}

const updateCompetitorDisplayName = (table: string, { type, userId, ...data }: DisplayNameUpdatedEvent) =>
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

const putLeaderboard = (table: string, { type, id, ...data }: LeaderboardCreatedEvent) =>
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

const putCompetitor = (table: string, { type, id, ...data }: CompetitorAddedEvent) =>
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
