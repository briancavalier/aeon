export type Filter<A> =
  | { readonly type: 'and', readonly value: readonly Filter<A>[] }
  | { readonly type: 'or', readonly value: readonly Filter<A>[] }
  | { readonly type: 'prefix', readonly value: A, readonly attribute: string }
  | { readonly type: 'comparison', readonly value: A, readonly attribute: string, readonly operator: Operator }

export type Operator = '=' | '>' | '>=' | '<' | '<=' | '<>'

export const and = <A>(...value: readonly Filter<A>[]): Filter<A> => ({ type: 'and', value })
export const or = <A>(...value: readonly Filter<A>[]): Filter<A> => ({ type: 'or', value })
export const prefix = <A>(attribute: string, value: A): Filter<A> => ({ type: 'prefix', value, attribute })
export const eq = <A>(attribute: string, value: A): Filter<A> => ({ type: 'comparison', value, attribute, operator: '=' })
export const gt = <A>(attribute: string, value: A): Filter<A> => ({ type: 'comparison', value, attribute, operator: '>' })
export const gte = <A>(attribute: string, value: A): Filter<A> => ({ type: 'comparison', value, attribute, operator: '>=' })
export const lt = <A>(attribute: string, value: A): Filter<A> => ({ type: 'comparison', value, attribute, operator: '<' })
export const lte = <A>(attribute: string, value: A): Filter<A> => ({ type: 'comparison', value, attribute, operator: '<=' })
export const ne = <A>(attribute: string, value: A): Filter<A> => ({ type: 'comparison', value, attribute, operator: '<>' })
