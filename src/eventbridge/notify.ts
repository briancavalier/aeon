import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge'
import { DynamoDBStreamEvent } from 'aws-lambda'
import assert from 'node:assert'
import { Notification, Position } from '../eventstore'

assert(process.env.eventStoreName)
assert(process.env.eventBusName)

const eventStoreName = process.env.eventStoreName

const client = new EventBridgeClient({ region: process.env.AWS_REGION })

export const handler = ({ Records }: DynamoDBStreamEvent) => {
  console.log(JSON.stringify(Records, null, 2))
  const positions = Records.map(r => r.dynamodb?.Keys?.position?.S).filter((p): p is Position => !!p).sort()

  console.debug('Notifying', positions)

  return client.send(new PutEventsCommand({
    Entries: [{
      EventBusName: process.env.eventBusName,
      Detail: JSON.stringify({
        eventStoreName,
        range: {
          start: positions[0],
          end: positions[positions.length - 1]
        }
      } satisfies Notification),
      DetailType: 'appended',
      Source: eventStoreName,
    }]
  }))
}
