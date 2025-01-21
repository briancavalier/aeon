import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { Position } from '../../src/eventstore'

export const getPosition = async (ddb: DynamoDBDocumentClient, table: string, subscriptionId: string) => {
  const { Item } = await ddb.send(new GetCommand({
    TableName: table,
    Key: {
      pk: 'subscription',
      sk: subscriptionId
    }
  }))

  return Item?.position as Position | undefined
}

export const updatePosition = (ddb: DynamoDBDocumentClient, table: string, subscriptionId: string, position: string) =>
  ddb.send(new UpdateCommand({
    TableName: table,
    Key: {
      pk: 'subscription',
      sk: subscriptionId
    },
    UpdateExpression: 'set #position = :position',
    ExpressionAttributeNames: {
      '#position': 'position'
    },
    ExpressionAttributeValues: {
      ':position': position
    },
    ConditionExpression: 'attribute_not_exists(pk) or :position > #position',
  }))
