import { Position } from './position';

export type Pending<D> = {
  readonly type: string
  readonly correlationId?: string
  readonly data: D
}

export type Committed<D> = Pending<D> & {
  readonly key: string
  readonly position: Position
  readonly committedAt: string
}
