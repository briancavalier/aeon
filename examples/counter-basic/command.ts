import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { APIGatewayProxyEvent } from 'aws-lambda'
import { ok as assert } from 'node:assert'
import { DynamoDB } from '../../src/eventstore'
import { CounterCommand, decide, initialValue, update } from "../aggregate"
import { CounterEvent } from '../domain'

assert(process.env.eventStoreConfig)

const client = new DynamoDBClient({})
const store = DynamoDB.fromConfigString(process.env.eventStoreConfig, client)

export const handler = async (event: APIGatewayProxyEvent) => {
  // In a real app, we'd parse+validate the incoming command
  const command = JSON.parse(event.body ?? '') as CounterCommand

  // Read the counter's event history from the event store
  const history = store.read<CounterEvent>(`counter/${command.name}`)

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
  // This returns the revision of the last event appended
  return store.append(`counter/${command.name}`, events.map(data => ({ type: data.type, data })))
}
