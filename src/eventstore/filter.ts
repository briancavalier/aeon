export type Filter<A> =
  | { readonly type: 'and', readonly value: readonly Filter<A>[] }
  | { readonly type: 'or', readonly value: readonly Filter<A>[] }
  | { readonly type: 'prefix', readonly value: A, readonly attribute: string }
  | { readonly type: Operator, readonly value: A, readonly attribute: string }

export type Operator = '=' | '>' | '>=' | '<' | '<=' | '<>'

export const and = <A>(...value: readonly Filter<A>[]): Filter<A> => ({ type: 'and', value })
export const or = <A>(...value: readonly Filter<A>[]): Filter<A> => ({ type: 'or', value })
export const prefix = <A>(attribute: string, value: A): Filter<A> => ({ type: 'prefix', value, attribute })
export const eq = <A>(attribute: string, value: A): Filter<A> => ({ type: '=', value, attribute })
export const gt = <A>(attribute: string, value: A): Filter<A> => ({ type: '>', value, attribute })
export const gte = <A>(attribute: string, value: A): Filter<A> => ({ type: '>=', value, attribute })
export const lt = <A>(attribute: string, value: A): Filter<A> => ({ type: '<', value, attribute })
export const lte = <A>(attribute: string, value: A): Filter<A> => ({ type: '<=', value, attribute })
export const ne = <A>(attribute: string, value: A): Filter<A> => ({ type: '<>', value, attribute })
