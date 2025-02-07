import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge'
import { DynamoDBStreamEvent } from 'aws-lambda'
import { ok as assert } from 'node:assert'
import { parseConfig } from '../eventstore'

assert(process.env.eventStoreConfig)
assert(process.env.eventBusName)

const eventStoreConfig = parseConfig(process.env.eventStoreConfig)

const client = new EventBridgeClient()

export const handler = ({ Records }: DynamoDBStreamEvent) => {
  if (Records.length === 0) return

  // Find the latest revision in the batch
  const end = Records.reduce((end, { dynamodb }) =>
    dynamodb?.Keys?.revision?.S && dynamodb.Keys.revision.S > end
      ? dynamodb.Keys.revision.S : end, '')

  const keys = [...new Set(Records.map(({ dynamodb }) => dynamodb?.NewImage?.key?.S).filter((k): k is string => !!k))]

  const notification = { eventStoreConfig, end, keys }
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
