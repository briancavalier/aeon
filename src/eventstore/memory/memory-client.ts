import { monotonicFactory } from 'ulid'
import { AppendOptions, AppendResult, Committed, EventStoreClient, Pending, ReadOptions } from '../event-store-client'
import { always } from '../filter'
import { Revision, end, ensureInclusive, start } from '../revision'
import { interpretFilter } from './filter-predicate'

export class MemoryEventStoreClient implements EventStoreClient {
  private events: Committed<unknown>[] = []

  constructor(
    public readonly name: string,
    private readonly nextRevision = monotonicFactory() as (epochMilliseconds: number) => Revision
  ) { }

  async append<Event>(key: string, events: readonly Pending<Event>[], { expectedRevision = end }: AppendOptions = {}): Promise<AppendResult> {
    if (events.length === 0) return { type: 'unchanged' }

    const now = Date.now()
    const currentRevision = await this.head(key)

    if (expectedRevision !== end && expectedRevision !== currentRevision) {
      return { type: 'aborted/optimistic-concurrency', error: new Error('Optimistic concurrency check failed'), expectedRevision }
    }

    const committedAt = new Date(now).toISOString()
    const newEvents = events.map(e => ({ ...e, key, revision: this.nextRevision(now), committedAt }))

    this.events.push(...newEvents)

    return { type: 'appended', count: events.length, revision: newEvents[newEvents.length - 1].revision }
  }

  async head(key: string): Promise<Revision> {
    return this.events.findLast(e => e.key === key)?.revision ?? start
  }

  async *read<Event>(key: string, { filter = always, ...r }: ReadOptions = {}): AsyncIterable<Committed<Event>> {
    const range = ensureInclusive(r)
    if (range.start > range.end) return

    const sortedEvents = range.direction === 'backward' ? this.events.reverse() : this.events

    for (const event of sortedEvents)
      if (event.key === key &&
        event.revision >= range.start &&
        event.revision <= range.end &&
        interpretFilter(filter, event)) yield event as Committed<Event>
  }

  async *readAll<Event>({ filter = always, ...r }: ReadOptions = {}): AsyncIterable<Committed<Event>> {
    const range = ensureInclusive(r)
    if (range.limit <= 0 || range.start > range.end) return

    const sortedEvents = range.direction === 'backward' ? this.events.reverse() : this.events

    for (const event of sortedEvents)
      if (event.revision >= range.start &&
        event.revision <= range.end &&
        interpretFilter(filter, event)) yield event as Committed<Event>
  }
}
