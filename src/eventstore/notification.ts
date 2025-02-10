import { EventStoreConfig } from './client'
import { Revision } from './revision'

export type Notification = Readonly<{
  eventStoreConfig: EventStoreConfig,
  revision: Revision
  events: readonly Readonly<{ key: string, type: string }>[]
}>
