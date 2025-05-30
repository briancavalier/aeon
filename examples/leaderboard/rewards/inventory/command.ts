import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { APIGatewayProxyEvent } from 'aws-lambda'
import assert from 'node:assert'
import { reduce } from '../../../../src/eventstore'
import { fromConfigString } from '../../../../src/eventstore/dynamodb'
import { InventoryEvent } from '../domain'

assert(process.env.eventStoreConfig)

const client = new DynamoDBClient({})
const store = fromConfigString(process.env.eventStoreConfig, client)

type InventoryCommand =
  | Readonly<{ type: 'add'; rewardId: string; name: string; price: number }>
  | Readonly<{ type: 'remove'; rewardId: string }>

type Reward = Readonly<{ rewardId: string; name: string; price: number }>

export const handler = async (event: APIGatewayProxyEvent) => {
  const command = JSON.parse(event.body ?? '') as InventoryCommand
  const correlationId = event.headers['x-correlation-id'] ?? event.requestContext.requestId

  const key = 'reward-inventory'
  const revision = await store.head(key)
  const history = store.read<InventoryEvent>(key, { end: revision })

  const rewards = await reduce(
    history,
    (rewards, { data }) => update(rewards, data),
    new Map<string, Reward>()
  )

  const events = decide(rewards, command)

  return store.append(
    key,
    events.map(data => ({ type: data.type, correlationId, data })),
    { expectedRevision: revision }
  )
}

const update = (rewards: Map<string, Reward>, event: InventoryEvent) => {
  switch (event.type) {
    case 'reward-added':
      return add(rewards, { rewardId: event.rewardId, name: event.name, price: event.price })
    case 'reward-removed':
      return remove(rewards, event.rewardId)
  }
}

const add = (rewards: Map<string, Reward>, reward: Reward) =>
  new Map(rewards).set(reward.rewardId, reward)

const remove = (rewards: Map<string, Reward>, rewardId: string) => {
  const newRewards = new Map(rewards)
  newRewards.delete(rewardId)
  return newRewards
}

const decide = (rewards: Map<string, Reward>, command: InventoryCommand) => {
  switch (command.type) {
    case 'add':
      return rewards.has(command.rewardId) ? [] : [{ ...command, type: 'added' }]
    case 'remove':
      return !rewards.has(command.rewardId) ? [] : [{ ...command, type: 'removed' }]
  }
}
