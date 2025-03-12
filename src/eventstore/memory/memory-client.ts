import { EventEmitter } from 'node:events'
import { monotonicFactory } from 'ulid'
import { AppendOptions, AppendResult, Committed, EventStoreClient, Pending, ReadOptions } from '../event-store-client'
import { always } from '../filter'
import { Notification } from '../notification'
import { Revision, end, ensureInclusive, start } from '../revision'
import { interpretFilter } from './filter-predicate'

export class MemoryEventStoreClient implements EventStoreClient {
  private events: Committed<unknown>[] = []
  private notifyStart = 0
  private notifyTimer: ReturnType<typeof setImmediate> | undefined

  constructor(
    public readonly name: string,
    private readonly notifications?: EventEmitter<{ appended: [Notification] }>,
    private readonly nextRevision = monotonicFactory() as (epochMilliseconds: number) => Revision
  ) { }

  async append<Event>(key: string, events: readonly Pending<Event>[], { expectedRevision = end }: AppendOptions = {}): Promise<AppendResult> {
    if (events.length === 0) return { type: 'unchanged' }

    const currentRevision = head(key, this.events)

    if (expectedRevision !== end && expectedRevision !== currentRevision)
      return { type: 'aborted/optimistic-concurrency', error: new Error('Optimistic concurrency check failed'), expectedRevision }

    const now = Date.now()
    const committedAt = new Date(now).toISOString()
    const newEvents = events.map(e => ({ ...e, key, revision: this.nextRevision(now), committedAt }))

    this.events.push(...newEvents)

    this.notify()

    return { type: 'appended', count: events.length, revision: newEvents[newEvents.length - 1].revision }
  }

  async head(key: string): Promise<Revision> {
    return head(key, this.events)
  }

  async *read<Event>(key: string, { filter = always, ...r }: ReadOptions = {}): AsyncIterable<Committed<Event>> {
    const range = ensureInclusive(r)

    const sortedEvents = range.direction === 'backward' ? this.events.reverse() : this.events

    for (const event of sortedEvents)
      if (event.key === key &&
        event.revision >= range.start &&
        event.revision <= range.end &&
        interpretFilter(filter, event)) yield event as Committed<Event>
  }

  async *readAll<Event>({ filter = always, ...r }: ReadOptions = {}): AsyncIterable<Committed<Event>> {
    const range = ensureInclusive(r)

    const sortedEvents = range.direction === 'backward' ? this.events.reverse() : this.events

    for (const event of sortedEvents)
      if (event.revision >= range.start &&
        event.revision <= range.end &&
        interpretFilter(filter, event)) yield event as Committed<Event>
  }

  private notify() {
    if (!this.notifications) return
    clearImmediate(this.notifyTimer)
    this.notifyTimer = setImmediate(() => {
      const revision = this.events[this.events.length - 1].revision
      const events = this.events.slice(this.notifyStart).map(({ key, type }) => ({ key, type }))
      this.notifyStart = this.events.length
      this.notifications!.emit('appended', { revision, events })
    })
  }
}

const head = (key: string, events: readonly Committed<unknown>[]): Revision =>
  events.findLast(e => e.key === key)?.revision ?? start
