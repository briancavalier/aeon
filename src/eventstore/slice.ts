import { Revision } from './revision'

export type Slice = string & { readonly type: 'Slice' }

export const sliceLen = 5

export const getSlice = (p: Revision): Slice =>
  p.slice(0, sliceLen) as Slice

export const sliceStart = (p: Slice): Revision =>
  p.padEnd(26, '0') as Revision

export const sliceEnd = (p: Slice): Revision =>
  p.padEnd(26, 'Z') as Revision
