export type Filter<A> =
  | { readonly _type: 'true' }
  | { readonly _type: 'exists' }
  | { readonly _type: Operator; readonly value: A }
  | { readonly [K in string]: Filter<A> }

type Operator = 'prefix' | '=' | '>' | '>=' | '<' | '<=' | '<>'

export const hasType = <const F extends Filter<unknown>>(filter: F): filter is Extract<F, { readonly _type: string }> =>
  typeof filter._type === 'string'

export const exists = { _type: 'exists' } as const
export const always = { _type: 'true' } as const

export const prefix = <A>(value: A): Filter<A> => ({ _type: 'prefix', value })
export const eq = <A>(value: A): Filter<A> => ({ _type: '=', value })
export const gt = <A>(value: A): Filter<A> => ({ _type: '>', value })
export const gte = <A>(value: A): Filter<A> => ({ _type: '>=', value })
export const lt = <A>(value: A): Filter<A> => ({ _type: '<', value })
export const lte = <A>(value: A): Filter<A> => ({ _type: '<=', value })
export const ne = <A>(value: A): Filter<A> => ({ _type: '<>', value })

