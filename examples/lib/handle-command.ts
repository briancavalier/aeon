import { append, EventStoreClient, readKey, readKeyLatest } from '../../src/eventstore'

type Command<C> = Readonly<{
  key: string,
  type: string,
  timestamp?: string,
  correlationId?: string,
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
) => async (client: EventStoreClient, command: Command<C>, idempotencyKey?: string) => {
  console.info(command)
  const history = readKey(client, command.key)

  let state = init
  for await (const event of history)
    state = update(state, event.data as E)

  const events = decide(state, command.data)
  const timestamp = command.timestamp ?? new Date().toISOString()
  const appended = await append(client, events.map(data => ({ ...command, timestamp, data })), idempotencyKey)

  console.debug({ command, state, events, timestamp, appended })

  return {
    [client.name]: appended ?? (await readKeyLatest(client, command.key))?.position
  }
}
