import { EventStoreConfig } from './client'
import { Revision } from './revision'

export type Notification = Readonly<{
  eventStoreConfig: EventStoreConfig,
  end: Revision
  keys: readonly string[]
}>
