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
  const history = store.read<TransactionEvent>(key, { end: revision })

  const account = await reduce(
    history,
    (account, { data }) => update(account, data),
    initial
  )

  const events = decide(account, command)

  const result = await store.append(
    key,
    events.map(data => ({ type: data.type, data })),
    {
      expectedRevision: revision,
      idempotencyKey: command.transactionId
    }
  )

  switch (result.type) {
    case 'appended':
      return {
        type: 'ok',
        transactionId: command.transactionId
      }
    case 'unchanged':
      return {
        type: 'duplicate',
        transactionId: command.transactionId,
      }
    case 'aborted/optimistic-concurrency':
      return {
        type: 'retry',
        transactionId: command.transactionId,
      }
    case 'aborted/unknown':
      return {
        type: 'failed',
        transactionId: command.transactionId,
        reason: 'unknown error'
      }
  }
}
