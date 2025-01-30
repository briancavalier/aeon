import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { APIGatewayProxyEvent } from 'aws-lambda'
import { ok as assert } from 'node:assert'
import { appendKey, fromConfigString, readKey } from '../../src/eventstore'
import { CounterCommand, CounterEvent, decide, initialValue, update } from './domain'

assert(process.env.eventStoreConfig)

const client = new DynamoDBClient({})
const store = fromConfigString(process.env.eventStoreConfig, client)

export const handler = async (event: APIGatewayProxyEvent) => {
  // In a real app, we'd parse+validate the incoming command
  const command = JSON.parse(event.body ?? '') as CounterCommand

  // Read the counter's event history from the event store
  const history = readKey<CounterEvent>(store, `counter/${command.key}`)

  // Rebuild the counter's current value from the event history
  let value = initialValue
  for await (const event of history) {
    console.info(event)
    value = update(value, event.data)
  }

  // Essential domain logic: Decide what new events have occurred
  // based on the current value and incoming command
  const events = decide(value, command)

  // Append the new events to the event store
  // This returns the commit position of the last event appended
  return appendKey(store, `counter/${command.key}`, events.map(data => ({ ...data, data })))
}
