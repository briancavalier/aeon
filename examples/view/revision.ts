import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb'
import { Position } from '../../src/eventstore'

/**
 * A compound revision from multiple event stores.
 */
export type Revision = Record<string, Position>

/**
 * A `requested` {@link Revision} has been seen iff all its Position values
 * are less than or equal to the corresponding {@link Positions} of the
 * `current` revision, or the corresponding key is not present in `current`.
 */
export const hasSeenRevision = (current: Revision, requested: Revision): boolean => {
  for (const [key, value] of Object.entries(requested)) {
    const c = current[key]
    if (!c || c < value) return false
  }

  return true
}

/**
 * Get the current {@link Revision} from the view table.
 */
export const getRevision = async (ddb: DynamoDBDocumentClient, table: string): Promise<Revision> => {
  const { Item } = await ddb.send(new GetCommand({
    TableName: table,
    Key: {
      pk: 'subscription',
      sk: 'revision'
    }
  }))

  return Item?.revision ? JSON.parse(Item.revision) : {}
}

/**
 * Update the current {@link Revision} in the view table.
 */
export const updateRevision = (ddb: DynamoDBDocumentClient, table: string, revision: Revision): Promise<unknown> =>
  ddb.send(new PutCommand({
    TableName: table,
    Item: {
      pk: 'subscription',
      sk: 'revision',
      revision: JSON.stringify(revision)
    },
  }))
