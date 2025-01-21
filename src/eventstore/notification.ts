import { Position } from './position'

export type Notification = Readonly<{
  eventStoreName: string,
  end: Position
}>
