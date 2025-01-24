import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { APIGatewayProxyEvent } from 'aws-lambda'
import { ok as assert } from 'node:assert'
import { append, fromConfigString, Position, readKey, readKeyLatest } from '../../src/eventstore'
import { CounterCommand, CounterEvent, decide, initialValue, update } from '../counter/domain'
import { CounterSnapshot, snapshotRange } from './counter-snapshot'

assert(process.env.eventStoreConfig)
assert(process.env.snapshotStoreConfig)

const client = new DynamoDBClient({})
const store = fromConfigString(process.env.eventStoreConfig, client)
const snapshotStore = fromConfigString(process.env.snapshotStoreConfig, client)

const maxEventsBetweenSnapshots = 10

export const handler = async (event: APIGatewayProxyEvent) => {
  // In a real app, we'd parse+validate the incoming command
  const command = JSON.parse(event.body ?? '') as CounterCommand

  const snapshot = await readKeyLatest<CounterSnapshot>(snapshotStore, command.key)

  const range = snapshotRange(snapshot?.data)
  console.debug({ snapshot, range })

  // Read the counter's event history from the event store
  const history = readKey<CounterEvent>(store, command.key, range)

  // Rebuild the counter's current value from the event history
  let value = snapshot?.data.value ?? initialValue
  let eventCount = 0
  for await (const event of history) {
    console.info(event)
    value = update(value, event.data)
    eventCount++
  }

  console.debug({ snapshot, value })

  // Essential domain logic: Decide what new events have occurred
  // based on the current value and incoming command
  const events = decide(value, command)

  const timestamp = new Date().toISOString()

  // Append the new events to the event store
  // This returns the commit position of the last event appended
  const position = await append(store, events.map(data => ({ ...data, timestamp, data })))

  if (position && eventCount >= maxEventsBetweenSnapshots) {
    const newValue = events.reduce(update, value)
    console.debug({ msg: 'Adding new snapshot', newValue, timestamp, position })

    await appendNewSnapshot(command.key, newValue, timestamp, position)
  } else {
    console.debug({ msg: 'Not adding new snapshot', eventCount, maxEventsBetweenSnapshots })
  }

  return { statusCode: 202, body: position }
}

const appendNewSnapshot = async (key: string, value: number, timestamp: string, revision?: Position) => {
  const newSnapshot = {
    key,
    type: 'snapshot',
    timestamp,
    data: { revision, value }
  }

  return append(snapshotStore, [newSnapshot])
}
