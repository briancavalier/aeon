import { Position } from './position'

export type Slice = string & { readonly type: 'Slice' }

export const sliceLen = 5

export const getSlice = (p: Position): Slice =>
  p.slice(0, sliceLen) as Slice

export const sliceStart = (p: Slice): Position =>
  p.padEnd(26, '0') as Position

export const sliceEnd = (p: Slice): Position =>
  p.padEnd(26, 'Z') as Position
