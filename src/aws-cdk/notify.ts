import { AttributeValue } from '@aws-sdk/client-dynamodb'
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge'
import { DynamoDBStreamEvent } from 'aws-lambda'
import { ok as assert } from 'node:assert/strict'
import { start } from '../eventstore'

assert(process.env.source)
assert(process.env.eventBusName)
const { source, eventBusName } = process.env

const client = new EventBridgeClient()

export const handler = ({ Records }: DynamoDBStreamEvent) => {
  if (Records.length === 0) return

  // Find the latest revision in the batch
  const revision = Records.reduce((end, { dynamodb }) =>
    dynamodb?.Keys?.revision?.S && dynamodb.Keys.revision.S > end
      ? dynamodb.Keys.revision.S : end, start as string)

  const events = Records.map(({ dynamodb }) => {
    if (!dynamodb?.NewImage) return undefined
    const { key, type } = dynamodb.NewImage as Record<string, AttributeValue>
    return { key: key.S, type: type.S }
  })

  const notification = { revision, events }
  console.debug({ msg: 'Notifying', ...notification })

  return client.send(new PutEventsCommand({
    Entries: [{
      EventBusName: eventBusName,
      Detail: JSON.stringify(notification),
      DetailType: 'appended',
      Source: source,
    }]
  }))
}
