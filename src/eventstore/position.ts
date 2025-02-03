import { nextBase32, prevBase32 } from './base32'

export type Position = string & { readonly type: 'Position' }

export const start = '0' as Position
export const end = 'Z' as Position

export const min = '00000000000000000000000000' as Position
export const max = '7ZZZZZZZZZZZZZZZZZZZZZZZZZ' as Position

/**
 * Inclusive range of positions from start to end. Start and end
 * are inclusive by default, but can be made exclusive by
 * setting `startExclusive` and/or `endExclusive` to true,
 * respectively.
 */
export type RangeInput = {
  readonly start?: Position
  readonly startExclusive?: boolean
  readonly end?: Position
  readonly endExclusive?: boolean
  readonly limit?: number
}

/**
 * Inclusive range of positions from start to end. Start and end
 * are inclusive by default, but can be made exclusive by
 * setting `startExclusive` and/or `endExclusive` to true,
 * respectively.
 */
export type InclusiveRange = {
  start: Position
  end: Position
  limit: number
}

/**
 * Given a {@link RangeInput}, adjust the start and end positions
 * to be inclusive, based on `startExclusive` and `endExclusive`,
 * and the limit to always have a value, using Infinity if not
 * specified.
 */
export const ensureInclusive = (r: RangeInput): InclusiveRange => ({
  start: r.start === end ? end
    : (!r.start || r.start === start) ? min
      : r.startExclusive ? nextBase32(r.start)
        : r.start,
  end: r.end === start ? start
    : (!r.end || r.end === end) ? max
      : r.endExclusive ? prevBase32(r.end)
        : r.end,
  limit: r.limit ?? Infinity
})
