import { Filter } from './filter'
import { Revision } from './revision'

/**
 * An event that hasn't yet been committed to the event store.
 */
export type Pending<A> = {
  readonly type: string
  readonly correlationId?: string
  readonly data: A
}

/**
 * An event that has been committed to the event store and is
 * now an irrefutible fact.
 */
export type Committed<A> = Pending<A> & {
  readonly key: string
  readonly revision: Revision
  readonly committedAt: string
}

/**
 * The core operations of an event store.
 */
export interface EventStoreClient {
  append<Event>(key: string, events: readonly Pending<Event>[], o?: AppendOptions): Promise<AppendResult>

  head(key: string): Promise<Revision>

  read<Event>(key: string, o?: ReadOptions): AsyncIterable<Committed<Event>>

  readAll<Event>(o?: ReadOptions): AsyncIterable<Committed<Event>>
}

/**
 * Options for appending events to the event store.
 */
export type AppendOptions = {
  readonly expectedRevision?: Revision,
  readonly idempotencyKey?: string
}

/**
 * Successful or failed outcome of an attempt to append events to
 * an event store.
 */
export type AppendResult =
  | { readonly type: 'unchanged' }
  | { readonly type: 'appended', readonly count: number, readonly revision: Revision }
  | { readonly type: 'aborted/optimistic-concurrency', readonly error: Error, readonly expectedRevision: Revision }
  | { readonly type: 'aborted/unknown', readonly error: unknown }

/**
 * Range of revisions from start to end. Start and end
 * are inclusive by default, but can be made exclusive by
 * setting `startExclusive` and/or `endExclusive` to true,
 * respectively.
 */
export type ReadOptions = {
  readonly start?: Revision
  readonly startExclusive?: boolean
  readonly end?: Revision
  readonly endExclusive?: boolean
  readonly limit?: number
  readonly direction?: 'forward' | 'backward'
  readonly filter?: Filter<string>
}
