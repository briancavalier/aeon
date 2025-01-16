import { nextBase32 } from './base32'
import { Position } from './position'

export type Slice = string & { readonly type: 'Slice' }

const sliceLen = 5

export const getSlice = (p: Position): Slice =>
  p.slice(0, sliceLen) as Slice

export const sliceStart = (p: Slice): Position =>
  p.padEnd(26, '0') as Position

export const sliceEnd = (p: Slice): Position =>
  p.padEnd(26, 'Z') as Position

export function* slices(start: Slice, end: Slice) {
  for (let p = start; p <= end; p = nextBase32(p))
    yield p
}
