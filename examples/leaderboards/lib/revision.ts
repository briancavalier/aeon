import { Position } from '../../../src/eventstore'

/**
 * A compound revision from multiple event stores.
 */
export type Revision = Readonly<Record<string, Position>>

/**
 * A `requested` {@link Revision} has been seen iff all its Position values
 * are less than or equal to the corresponding {@link Positions} of the
 * `current` revision, or the corresponding key is not present in `current`.
 */
export const hasSeenRevision = (current: Revision, requested: Revision): boolean => {
  for (const [key, value] of Object.entries(requested)) {
    const c = current[key]
    if (!c || c < value) return false
  }

  return true
}
