import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { APIGatewayProxyEvent } from 'aws-lambda'
import { ok as assert } from 'node:assert'
import { EventStoreClient, append, fromConfigString, head, read, reduce } from '../../../src/eventstore'
import { Event } from "../domain"
import { Command, decide, initialStock, update } from "./behavior"

// assert(process.env.eventStoreConfig)

// const client = new DynamoDBClient()
// const store = fromConfigString(process.env.eventStoreConfig, client)

// export const handler = async (event: APIGatewayProxyEvent) => {
//   const command = JSON.parse(event.body ?? '') as Command

//   const result = await handleCommand(store, command)

//   if (result.type === 'appended') {
//     return {
//       statusCode: 200,
//       body: result,
//       headers: { Etag: result.revision }
//     }
//   } else {
//     return {
//       statusCode: 409,
//       body: result
//     }
//   }
// }

export const handleCommand = async (store: EventStoreClient, command: Command) => {
  const revision = await head(store, command.truck)
  const history = read<Event>(store, command.truck)

  const stock = await reduce(history, (stock, { data }) => update(stock, data), initialStock)

  const events = decide(stock, command)

  return append(
    store,
    command.truck,
    events.map(data => ({ type: data.type, data })),
    { expectedRevision: revision }
  )
}
