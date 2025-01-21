import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge'
import { DynamoDBStreamEvent } from 'aws-lambda'
import assert from 'node:assert'
import { parseConfig } from '../eventstore'

assert(process.env.eventStoreConfig)
assert(process.env.eventBusName)

const eventStoreConfig = parseConfig(process.env.eventStoreConfig)

const client = new EventBridgeClient()

export const handler = ({ Records }: DynamoDBStreamEvent) => {
  if (Records.length === 0) return

  // Find the highest position in the batch
  const end = Records.reduce((end, { dynamodb }) =>
    dynamodb?.Keys?.position?.S && dynamodb.Keys.position.S > end
      ? dynamodb.Keys.position.S : end, '')

  const notification = { eventStoreConfig, end }
  console.debug({ msg: 'Notifying', notification })

  return client.send(new PutEventsCommand({
    Entries: [{
      EventBusName: process.env.eventBusName,
      Detail: JSON.stringify(notification),
      DetailType: 'appended',
      Source: eventStoreConfig.name,
    }]
  }))
}
