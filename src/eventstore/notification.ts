import { EventStoreConfig } from './client'
import { Position } from './position'

export type Notification = Readonly<{
  eventStoreConfig: EventStoreConfig,
  end: Position
  keys: readonly string[]
}>
