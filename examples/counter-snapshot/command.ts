import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { APIGatewayProxyEvent } from 'aws-lambda'
import { ok as assert } from 'node:assert'
import { append, fromConfigString, read, reduce, first, head } from '../../src/eventstore'
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
  const snapshotRevision = await head(store, `counter-snapshot/${command.key}`)
  const snapshot = await first(read<CounterSnapshot>(
    store,
    `counter-snapshot/${command.key}`,
    { start: snapshotRevision, end: snapshotRevision, limit: 1 }
  ))

  // Compute the range of events we need to read
  // If the snapshot exists, start reading from its revision
  // Otherwise, start from the beginning of the event store
  const range = snapshotRange(snapshot?.data)
  console.debug({ snapshot, range })

  const revision = await head(store, `counter/${command.key}`)
  const history = read<CounterEvent>(store, `counter/${command.key}`, { ...range, end: revision })

  // Rebuild the counter's current value
  // If we have a snapshot, start from its value. Otherwise, start
  // from the initial value. We'll also count the number of events
  // as we go, so we know when to take a new snapshot.
  const [value, count] = await reduce(
    history,
    ([value, count], event) => [update(value, event.data), count + 1],
    [initialValue, 0]
  )

  console.debug({ snapshot, value })

  // Essential domain logic: Decide what new events have occurred
  // based on the current value and incoming command
  const events = decide(value, command)
  const eventCount = count + events.length

  // Append the new events to the event store
  // This returns the revision of the last event appended
  const result = await append(
    store,
    `counter/${command.key}`,
    events.map(data => ({ ...data, data })),
    { expectedRevision: revision }
  )

  // If we wrote some new events, and it's time to take
  // a new snapshot, compute the latest snapshot value and
  // append it to the snapshot store.
  if (result.type === 'appended' && result.count > 0 && eventCount >= maxEventsBetweenSnapshots) {
    const newValue = events.reduce(update, value)
    console.debug({ msg: 'Adding new snapshot', newValue, revision: result.revision })

    await append(store, `counter-snapshot/${command.key}`, [{
      type: 'snapshot-created',
      data: { revision: result.revision, value: newValue }
    }], { expectedRevision: snapshotRevision })
  } else {
    console.debug({ msg: 'Not adding new snapshot', eventCount, maxEventsBetweenSnapshots })
  }

  return { statusCode: result.type === 'appended' ? 200 : 409, body: result }
}
