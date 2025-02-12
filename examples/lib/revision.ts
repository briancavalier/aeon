import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb'
import { Revision, start } from '../../src/eventstore'

export const getRevision = async (ddb: DynamoDBDocumentClient, table: string): Promise<Revision> =>
  ddb.send(new GetCommand({
    TableName: table,
    Key: { pk: 'revision' }
  })).then(({ Item }) => Item?.revision ?? start)

export const updateRevision = (ddb: DynamoDBDocumentClient, table: string, revision: Revision): Promise<unknown> =>
  ddb.send(new PutCommand({
    TableName: table,
    Item: { pk: 'revision', revision },
    ConditionExpression: 'attribute_not_exists(#revision) or #revision <= :revision',
    ExpressionAttributeNames: { '#revision': 'revision' },
    ExpressionAttributeValues: { ':revision': revision }
  }))
