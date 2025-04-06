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

export const handler = async ({ revision }: Notification) => {
  console.debug({ eventStoreConfig, revision })

  const events = store.readAll({
    end: revision,
    filter: {
      key: prefix('leaderboard/'),
      type: eq('finished')
    }
  })

  for await (const event of events) {
    const { data } = event as Committed<Extract<LeaderboardEvent, Readonly<{ type: 'finished' }>>>
    await Promise.all(
      data.competitors.toSorted((a, b) => b.score - a.score)
        .map(({ userId }, i) =>
          send(credit(userId, `${event.key}/${userId}`, i + 1))
        )
    )
  }
}

const credit = (userId: string, transactionId: string, rank: number) => ({
  type: 'credit',
  userId,
  amount: rankCredits[rank - 1],
  transactionId,
  memo: `Leaderboard rank ${rank}`
}) as const

const send = invoke<SendCommand>(new LambdaClient({}), 'account-command-handler')

const rankCredits = [100, 90, 80, 70, 60, 50, 40, 30, 20, 10]
