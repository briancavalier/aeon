import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { Committed, eventStore, nextPosition, Notification, read } from '../../src/eventstore'
import { LeaderboardEvent } from '../domain'
import { getCurrentRevision, updateRevision } from './revision'

export const subscriber = (metadataTable: string, client: DynamoDBClient, h: (event: unknown, eventStoreName: string) => Promise<unknown>) =>
  async ({ eventStoreName, range }: Notification) => {
    const store = eventStore(eventStoreName, client)

    const start = await getCurrentRevision(client, metadataTable)

    console.debug('Reading events', start, range)

    const events = read(store, { ...range, start: start ? nextPosition(start) : undefined }) as AsyncIterable<Committed<string, string, LeaderboardEvent>>

    for await (const { data } of events)
      await h(data, eventStoreName)

    if (!start || range.end > start) await updateRevision(client, metadataTable, range.end)
  }
