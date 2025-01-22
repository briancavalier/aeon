import { nextBase32, prevBase32 } from './base32'

export type Position = string & { readonly type: 'Position' }

/** Range of positions from start to end. Start and end
 * are inclusive by default, but can be made exclusive by
 * setting `startExclusive` and/or `endExclusive` to true,
 * respectively.
 */
export type Range = {
  readonly start: Position
  readonly startExclusive?: boolean
  readonly end: Position
  readonly endExclusive?: boolean
}

/**
 * Given a {@link Range}, adjust the start and end positions
 * to be inclusive, based on `startExclusive` and `endExclusive`
 */
export const ensureInclusive = (r: Partial<Range>): Partial<Range> => ({
  start: r.start && r.startExclusive ? nextBase32(r.start) : r.start,
  end: r.end && r.endExclusive ? prevBase32(r.end) : r.end
})
