import { Revision } from '../../../src/eventstore'

export type CounterSnapshot = Readonly<{
  revision: Revision
  value: number
}>

export const snapshotRange = (snapshot?: CounterSnapshot) =>
  snapshot
    ? { start: snapshot.revision, startExclusive: true } as const
    : {} as const
