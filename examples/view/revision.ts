import { DynamoDBClient, GetItemCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb'
import { Position } from '../../src/eventstore'

export const getCurrentRevision = async (ddb: DynamoDBClient, table: string) => {
  const { Item } = await ddb.send(new GetItemCommand({
    TableName: table,
    Key: { pk: { S: 'revision' }, sk: { S: 'leaderboard' } }
  }))

  return Item ? Item.revision.S as Position : undefined
}

export const updateRevision = (ddb: DynamoDBClient, table: string, revision: string) =>
  ddb.send(new UpdateItemCommand({
    TableName: table,
    Key: {
      pk: { S: 'revision' },
      sk: { S: 'leaderboard' },
    },
    UpdateExpression: 'set #revision = :revision',
    ExpressionAttributeNames: {
      '#revision': 'revision'
    },
    ExpressionAttributeValues: {
      ':revision': { S: revision }
    },
    ConditionExpression: 'attribute_not_exists(pk) or :revision > #revision',
  }))
