import { EventStoreConfig } from './client'
import { Revision } from './revision'

export type Notification = Readonly<{
  eventStoreConfig: EventStoreConfig,
  category: string
  end: Revision
}>
