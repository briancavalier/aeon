export type Id<A, T = string> = T & { readonly Id: unique symbol, type: A }
