import { DynamoDBClient, GetItemCommand, PutItemCommand } from '@aws-sdk/client-dynamodb'
import { EventStoreClient, Position, read } from '../../src/eventstore'
import { Revision } from '../lib/revision'

/**
 * Get the current {@link Revision} from the view table.
 */
export const getRevision = async (ddb: DynamoDBClient, table: string): Promise<Revision> => {
  const { Item } = await ddb.send(new GetItemCommand({
    TableName: table,
    Key: {
      pk: { S: 'subscription' },
      sk: { S: 'revision' }
    }
  }))

  return Item?.revision?.S ? JSON.parse(Item.revision.S) : {}
}

/**
 * Update the current {@link Revision} in the view table.
 */
export const updateRevision = (ddb: DynamoDBClient, table: string, revision: Revision): Promise<unknown> =>
  ddb.send(new PutItemCommand({
    TableName: table,
    Item: {
      pk: { S: 'subscription' },
      sk: { S: 'revision' },
      revision: { S: JSON.stringify(revision) }
    },
  }))

/**
 * Read all the events > given {@link Revision} and <= given
 * end {@link Position}.
 */
export const readAfterRevision = async (c: EventStoreClient, { [c.name]: start }: Revision, end: Position) =>
  start < end ? read(c, { start, startExclusive: true, end }) : []
