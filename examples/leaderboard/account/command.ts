import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import assert from 'node:assert'
import { reduce } from '../../../src/eventstore'
import { fromConfigString } from "../../../src/eventstore/dynamodb"
import { SendCommand } from './api'
import { TransactionCommand, decide, initial, update } from './behavior'
import { TransactionEvent } from './domain'

assert(process.env.eventStoreConfig)

const client = new DynamoDBClient({})
const store = fromConfigString(process.env.eventStoreConfig, client)

export const handler: SendCommand = async (command: TransactionCommand) => {
  const key = `account/${command.userId}`
  const revision = await store.head(key)
  const history = store.read<TransactionEvent>(key)

  const account = await reduce(
    history,
    (account, { data }) => update(account, data),
    initial
  )

  const events = decide(account, command)

  return store.append(
    key,
    events.map(data => ({ type: data.type, data })),
    { expectedRevision: revision }
  )
}
