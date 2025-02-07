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

  // Find the keys and latest revision of each category
  const categories = Records.reduce((n, { dynamodb }) => {
    const category = dynamodb?.NewImage?.category?.S
    if(!category) return n

    n[category] = dynamodb.Keys?.revision?.S as string
    return n
  }, {} as Record<string, string>)

  console.debug({ msg: 'Notifying', ...categories })

  // Notify each category of the latest revision
  const entries = Object.entries(categories).map(([category, end]) =>
    ({
      EventBusName: process.env.eventBusName,
      Detail: JSON.stringify({ eventStoreConfig, category, end }),
      DetailType: 'appended',
      Source: eventStoreConfig.name,
    }))

  return client.send(new PutEventsCommand({ Entries: entries }))
}
