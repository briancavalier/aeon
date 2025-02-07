import { nextBase32, prevBase32 } from './base32'

export type Revision = string & { readonly type: 'Revision' }

export const start = '0' as Revision
export const end = 'Z' as Revision

export const min = '00000000000000000000000000' as Revision
export const max = '7ZZZZZZZZZZZZZZZZZZZZZZZZZ' as Revision

/**
 * Range of revisions from start to end. Start and end
 * are inclusive by default, but can be made exclusive by
 * setting `startExclusive` and/or `endExclusive` to true,
 * respectively.
 */
export type RangeInput = {
  readonly start?: Revision
  readonly startExclusive?: boolean
  readonly end?: Revision
  readonly endExclusive?: boolean
  readonly limit?: number
  readonly direction?: 'forward' | 'backward'
}

/**
 * Inclusive range of revisions from start to end. Start and end
 * are inclusive by default, but can be made exclusive by
 * setting `startExclusive` and/or `endExclusive` to true,
 * respectively.
 */
export type InclusiveRange = {
  start: Revision
  end: Revision
  limit: number
  direction: 'forward' | 'backward'
}

/**
 * Given a {@link RangeInput}, adjust the start and end revisions
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
  limit: r.limit ?? Infinity,
  direction: r.direction ?? 'forward'
})
