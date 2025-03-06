import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { APIGatewayProxyEvent } from 'aws-lambda'
import { ok as assert } from 'node:assert'
import { DynamoDB, reduce } from '../../../src/eventstore'
import { CounterCommand, decide, initialValue, update } from "../aggregate"
import { CounterEvent } from '../domain'

assert(process.env.eventStoreConfig)

const client = new DynamoDBClient({})
const store = DynamoDB.fromConfigString(process.env.eventStoreConfig, client)

export const handler = async (event: APIGatewayProxyEvent) => {
  // In a real app, we'd parse+validate the incoming command
  const command = JSON.parse(event.body ?? '') as CounterCommand

  // Read the revision of the latest event for the counter
  // This is the optimistic concurrency control mechanism
  const revision = await store.head(`counter/${command.name}`)
  const history = store.read<CounterEvent>(`counter/${command.name}`)

  // Rebuild the counter's current value
  const value = await reduce(history, (value, { data }) => update(value, data), initialValue)

  // Essential domain logic: Decide what new events have occurred
  // based on the current value and incoming command
  const events = decide(value, command)

  // It's important that we append the new events if no other
  // events have been appended between the time we read the latest
  // event and the time we're appending the new events.
  // That guarantees the current state of the counter hasn't changed.
  const result = await store.append(
    `counter/${command.name}`,
    events.map(data => ({ ...data, data })),
    { expectedRevision: revision }
  )

  // If the append was successful, return 200
  // If the append failed due to optimistic concurrency control,
  // return 409, and the caller can try again if they want to.
  return {
    statusCode: result.type === 'appended' ? 200 : 409,
    body: result
  }
}
