import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { APIGatewayProxyEvent } from 'aws-lambda'
import { ok as assert } from 'node:assert'
import { appendKey, fromConfigString, Position, readForAppend, readKey, readKeyLatest } from '../../src/eventstore'
import { CounterCommand, CounterEvent, decide, initialValue, update } from '../counter-basic/domain'

assert(process.env.eventStoreConfig)
assert(process.env.snapshotStoreConfig)

const client = new DynamoDBClient({})
const store = fromConfigString(process.env.eventStoreConfig, client)

export const handler = async (event: APIGatewayProxyEvent) => {
  // In a real app, we'd parse+validate the incoming command
  const command = JSON.parse(event.body ?? '') as CounterCommand

  // Read the position of the latest event for the counter
  // This is the optimistic concurrency control mechanism
  const [position, history] = await readForAppend<CounterEvent>(store, `counter/${command.key}`)

  // Rebuild the counter's current value
  let value = initialValue
  for await (const event of history) {
    console.info(event)
    value = update(value, event.data)
  }

  // Essential domain logic: Decide what new events have occurred
  // based on the current value and incoming command
  const events = decide(value, command)

  const timestamp = new Date().toISOString()

  // It's important that we append the new events if no other
  // events have been appended between the time we read the latest
  // event and the time we're appending the new events.
  // That guarantees the current state of the counter hasn't changed.
  const result = await appendKey(
    store,
    `counter/${command.key}`,
    events.map(data => ({ ...data, timestamp, data })),
    { expectedPosition: position }
  )

  // If the append was successful, return 200
  // If the append failed due to optimistic concurrency control,
  // return 409, and the caller can try again if they want to.
  return {
    statusCode: result.type === 'appended' ? 200 : 409,
    body: result
  }
}
