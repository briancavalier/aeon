import { Range } from './position'

export type Notification = Readonly<{
  eventStoreName: string,
  range: Range
}>
