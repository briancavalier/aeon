import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { APIGatewayProxyEvent } from 'aws-lambda'
import { ok as assert } from 'node:assert'
import { fromConfigString, read } from '../../src/eventstore'
import { CounterEvent } from './domain'

assert(process.env.eventStoreConfig)
const store = fromConfigString(process.env.eventStoreConfig, new DynamoDBClient({}))

// Queries can be use-case specific, tailored to answer specific user or
// business questions.  This query returns the counter's current value,
// along with the number of increments and decrements.
export const handler = async (event: APIGatewayProxyEvent) => {
  const { key } = event.queryStringParameters ?? {}

  if (!key) return { statusCode: 400, body: 'key is required' }

  // Read all the events for the counter with the given key
  const events = read<CounterEvent>(store, `counter/${key}`)

  // Build answer from events
  let counter = { key, value: 0, increments: 0, decrements: 0 }
  for await (const { data } of events) {
    switch (data.type) {
      case 'incremented':
        counter = { ...counter, value: counter.value + 1, increments: counter.increments + 1 }
        break
      case 'decremented':
        counter = { ...counter, value: counter.value - 1, decrements: counter.decrements + 1 }
        break
    }
  }

  // Return the answer
  return counter
}
