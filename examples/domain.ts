/**
 * Domain events for the counter: a counter could have been
 * either incremented or decremented.
 */
export type CounterEvent =
  | Readonly<{ type: 'incremented', name: string }>
  | Readonly<{ type: 'decremented', name: string }>
