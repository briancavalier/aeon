import { append, EventStoreClient, readKey, readKeyLatest } from '../../../src/eventstore'

type Command<C> = {
  readonly key: string,
  readonly type: string,
  readonly timestamp?: string,
  readonly correlationId?: string,
  readonly data: C
}

type Event = {
  readonly type: string
}

export interface Decider<C, S, E> {
  decide(s: S, c: C): readonly E[]
  update(s: S, e: E): S
  readonly init: S
}

/**
 * Create an opinionated command handler that reads the history for a key, applies the command,
 * and appends any resulting events to the event store.
 */
export const handleCommand = async <C, S, E extends Event>(
  client: EventStoreClient,
  { decide, update, init }: Decider<C, S, E>,
  command: Command<C>,
  idempotencyKey?: string
) => {
  console.info(command)
  const history = readKey<E>(client, command.key)

  let state = init
  for await (const event of history)
    state = update(state, event.data)

  const events = decide(state, command.data)
  const timestamp = command.timestamp ?? new Date().toISOString()
  const appended = await append(client, events.map(data => ({
    ...command,
    timestamp,
    type: data.type,
    data
  })), idempotencyKey)

  console.debug({ command, state, events, timestamp, appended })

  return {
    [client.name]: appended ?? (await readKeyLatest(client, command.key))?.position
  }
}
