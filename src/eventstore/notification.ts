import { Revision } from './revision'

export type Notification = {
  readonly revision: Revision
  readonly events: readonly EventSummary[]
}

export type EventSummary = {
  readonly key: string,
  readonly type: string
}
