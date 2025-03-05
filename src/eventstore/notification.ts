import { EventStoreConfig } from './event-store-client'
import { Revision } from './revision'

export type EventSummary = {
  readonly key: string,
  readonly type: string
}

export type Notification = {
  readonly eventStoreConfig: EventStoreConfig,
  readonly revision: Revision
  readonly events: readonly EventSummary[]
}
