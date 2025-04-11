import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import { LambdaClient } from "@aws-sdk/client-lambda"
import assert from "node:assert"
import { Committed, Notification, eq, prefix } from "../../../src/eventstore"
import { fromConfigString } from "../../../src/eventstore/dynamodb"
import { SendCommand } from "../account/api"
import { invoke } from "../lib/lambda"
import { LeaderboardEvent } from "./domain"

assert(process.env.eventStoreConfig)
const { eventStoreConfig } = process.env

const client = new DynamoDBClient({})
const store = fromConfigString(process.env.eventStoreConfig, client)

export const handler = async ({ revision, events: newEvents }: Notification) => {
  console.debug({ eventStoreConfig, revision, newEvents })

  const events = store.readAll({
    end: revision,
    filter: {
      key: prefix('leaderboard/'),
      type: eq('finished')
    }
  })

  for await (const event of events) {
    const { data } = event as Committed<Extract<LeaderboardEvent, Readonly<{ type: 'finished' }>>>
    const results = await Promise.all(
      data.competitors.toSorted((a, b) => b.score - a.score)
        .map(async ({ userId }, i) =>
          credit(event.key, userId, `${event.key}/${userId}`, i + 1, 3))
    )
    console.debug({ msg: 'credited all', event, results })
  }
}

const credit = async (key: string, userId: string, transactionId: string, rank: number, triesRemaining: number): Promise<unknown> => {
  const amount = rankCredits[rank - 1]
  const result = await sendCredit(userId, transactionId, rank, amount)
  if (result.type === "ok") {
    console.debug({ msg: 'credited', userId, rank, transactionId })
    return store.append<LeaderboardEvent>(key, [{
      type: 'awarded',
      data: { type: 'awarded', userId, rank, transactionId, amount }
    }] as const)
  } else if (result.type === "duplicate") {
    console.debug({ msg: 'already credited', userId, rank, transactionId })
  } else if (result.type === "retry") {
    if (triesRemaining <= 0) {
      console.error({ msg: 'credit failed', userId, rank, transactionId, result })
      return store.append<LeaderboardEvent>(key, [{
        type: 'award-failed',
        data: { type: 'award-failed', userId, rank, transactionId, amount, reason: `failed after several tries` }
      }] as const)
    }
    console.debug({ msg: 'retrying credit', userId, rank, transactionId, amount })
    return credit(key, userId, transactionId, rank, triesRemaining - 1)
  } else if (result.type === "failed") {
    console.error({ msg: 'credit failed', userId, rank, transactionId, result })
    return store.append<LeaderboardEvent>(key, [{
      type: 'award-failed',
      data: { type: 'award-failed', userId, rank, transactionId, amount, reason: result.reason }
    }] as const)
  }
}

const sendCredit = (userId: string, transactionId: string, rank: number, amount: number) => send({
  type: 'credit',
  userId,
  amount,
  transactionId,
  memo: `Leaderboard rank ${rank}`
})

const send = invoke<SendCommand>(new LambdaClient({}), 'account-command-handler')

const rankCredits = [100, 90, 80, 70, 60, 50, 40, 30, 20, 10]
