import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb'
import { Revision } from '../../src/eventstore'

export const getRevision = async (ddb: DynamoDBDocumentClient, table: string, category: string): Promise<Revision> =>
  ddb.send(new GetCommand({
    TableName: table,
    Key: { pk: category }
  })).then(({ Item }) => Item?.revision)

export const updateRevision = (ddb: DynamoDBDocumentClient, table: string, category: string, revision: Revision): Promise<unknown> =>
  ddb.send(new PutCommand({
    TableName: table,
    Item: { pk: category, revision },
    ConditionExpression: 'attribute_not_exists(#revision) or #revision <= :revision',
    ExpressionAttributeNames: { '#revision': 'revision' },
    ExpressionAttributeValues: { ':revision': revision }
  }))
