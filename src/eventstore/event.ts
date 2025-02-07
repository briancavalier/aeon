import { Revision } from './revision';

export type Pending<D> = {
  readonly type: string
  readonly category?: string
  readonly correlationId?: string
  readonly data: D
}

export type Committed<D> = Pending<D> & {
  readonly key: string
  readonly revision: Revision
  readonly committedAt: string
}
