import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge'
import { DynamoDBStreamEvent } from 'aws-lambda'
import assert from 'node:assert'
import { Notification, Position } from '../eventstore'

assert(process.env.eventStoreName)
assert(process.env.eventBusName)

const eventStoreName = process.env.eventStoreName

const client = new EventBridgeClient({ region: process.env.AWS_REGION })

export const handler = ({ Records }: DynamoDBStreamEvent) => {
  if (Records.length === 0) return

  const end = Records.reduce((end, { dynamodb }) =>
    dynamodb?.Keys?.position?.S && dynamodb.Keys.position.S > end
      ? dynamodb.Keys.position.S : end, '') as Position

  const notification = { eventStoreName, end } satisfies Notification
  console.debug('Notifying', notification)

  return client.send(new PutEventsCommand({
    Entries: [{
      EventBusName: process.env.eventBusName,
      Detail: JSON.stringify(notification),
      DetailType: 'appended',
      Source: eventStoreName,
    }]
  }))
}
