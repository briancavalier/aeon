import { Committed, Position, Range } from '../../src/eventstore'

export type CounterSnapshot = Readonly<{
  revision: Position
  value: number
}>

export const snapshotRange = (snapshot?: CounterSnapshot): Partial<Range> => snapshot
  ? { start: snapshot.revision, startExclusive: true }
  : {}

export const snapshotAgeMs = (snapshot: Committed<CounterSnapshot>, now: string) =>
  new Date(snapshot.timestamp).getTime() - new Date(now).getTime()
