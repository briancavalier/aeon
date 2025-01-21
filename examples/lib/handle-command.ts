import { append, EventStoreClient, readKey, readKeyLatest } from '../../src/eventstore'

type Command<C> = Readonly<{
  key: string,
  type: string,
  timestamp?: string,
  data: C
}>

type Event = Readonly<{
  type: string
}>

/**
 * Create an opinionated command handler that reads the history for a key, applies the command,
 * and appends any resulting events to the event store.
 */
export const handleCommand = <C, S, E extends Event>(
  decide: (s: S, c: C) => readonly E[],
  update: (s: S, e: E) => S,
  init: S
) => async (client: EventStoreClient, c: Command<C>, idempotencyKey?: string) => {
  const history = readKey(client, c.key)

  let state = init
  for await (const event of history)
    state = update(state, event.data as E)

  const events = decide(state, c.data)
  const timestamp = c.timestamp ?? new Date().toISOString()
  const appended = await append(client, events.map(data => ({ ...c, timestamp, data })), idempotencyKey)

  return {
    [client.name]: appended ?? (await readKeyLatest(client, c.key))?.position
  }
}
