import { nextBase32 } from './base32'

export type Position = string & { readonly type: 'Position' }

export type Range = {
  readonly start: Position
  readonly end: Position
}

export const nextPosition = nextBase32<Position>
