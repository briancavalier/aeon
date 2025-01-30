import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { APIGatewayProxyEvent } from 'aws-lambda'
import { ok as assert } from 'node:assert'
import { appendKey, EventStoreClient, fromConfigString, Position, readForAppend, readKey, readKeyLatest } from '../../src/eventstore'
import { CounterCommand, CounterEvent, decide, initialValue, update } from '../counter-basic/domain'
import { CounterSnapshot, snapshotRange } from './counter-snapshot'

assert(process.env.eventStoreConfig)

const client = new DynamoDBClient({})
const store = fromConfigString(process.env.eventStoreConfig, client)

// Record an updated snapshot every 10 events. In a real application, this number
// may be higher, tuned to the application needs.
const maxEventsBetweenSnapshots = 10

export const handler = async (event: APIGatewayProxyEvent) => {
  // In a real app, we'd parse+validate the incoming command
  const command = JSON.parse(event.body ?? '') as CounterCommand

  // Read the latest snapshot from the snapshot store
  // If there are no snapshots yet, this will return undefined
  const snapshot = await readKeyLatest<CounterSnapshot>(
    store,
    `counter-snapshot/${command.key}`
  )

  // Compute the range of events we need to read
  // If the snapshot exists, start reading from its revision
  // Otherwise, start from the beginning of the event store
  const range = snapshotRange(snapshot?.data)
  console.debug({ snapshot, range })

  const [latest, history] = await readForAppend<CounterEvent>(store, `counter/${command.key}`, range)

  // Rebuild the counter's current value
  // If we have a snapshot, start from its value
  // Otherwise, start from the initial value
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
  eventCount += events.length

  const timestamp = new Date().toISOString()

  // Append the new events to the event store
  // This returns the commit position of the last event appended
  const result = await appendKey(
    store,
    `counter/${command.key}`,
    events.map(data => ({ ...data, timestamp, data })),
    { expectedPosition: latest }
  )

  // If we wrote some new events (position !== undefined), and
  // it's time to take a new snapshot, compute the latest
  // snapshot value and append it to the snapshot store.
  if (result.type === 'appended' && result.count > 0 && eventCount >= maxEventsBetweenSnapshots) {
    const newValue = events.reduce(update, value)
    console.debug({ msg: 'Adding new snapshot', newValue, timestamp, position: result.position })

    await appendNewSnapshot(store, command.key, newValue, timestamp, result.position)
  } else {
    console.debug({ msg: 'Not adding new snapshot', eventCount, maxEventsBetweenSnapshots })
  }

  return { statusCode: result.type === 'appended' ? 200 : 409, body: result }
}

const appendNewSnapshot = async (s: EventStoreClient, key: string, value: number, timestamp: string, revision?: Position) => {
  const newSnapshot = {
    type: 'snapshot-created',
    timestamp,
    data: { revision, value }
  }

  return appendKey(s, `counter-snapshot/${key}`, [newSnapshot])
}
