import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge'
import { DynamoDBStreamEvent } from 'aws-lambda'
import { ok as assert } from 'node:assert'
import { parseConfig, start } from '../eventstore'
import { AttributeValue } from '@aws-sdk/client-dynamodb'

assert(process.env.eventStoreConfig)
assert(process.env.eventBusName)

const eventStoreConfig = parseConfig(process.env.eventStoreConfig)

const client = new EventBridgeClient()

export const handler = ({ Records }: DynamoDBStreamEvent) => {
  if (Records.length === 0) return

  // Find the latest revision in the batch
  const revision = Records.reduce((end, { dynamodb }) =>
    dynamodb?.Keys?.revision?.S && dynamodb.Keys.revision.S > end
      ? dynamodb.Keys.revision.S : end, start as string)

  const events = Records.map(({ dynamodb }) => {
    if (!dynamodb?.NewImage) return undefined
    const { key, revision, type, committedAt } = dynamodb.NewImage as Record<string, AttributeValue>
    return { key: key.S, revision: revision.S, type: type.S, committedAt: committedAt.S }
  })

  const notification = { eventStoreConfig, revision, events }
  console.debug({ msg: 'Notifying', ...notification })

  return client.send(new PutEventsCommand({
    Entries: [{
      EventBusName: process.env.eventBusName,
      Detail: JSON.stringify(notification),
      DetailType: 'appended',
      Source: eventStoreConfig.name,
    }]
  }))
}
