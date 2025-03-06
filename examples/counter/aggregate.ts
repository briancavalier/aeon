import { CounterEvent } from "./domain"

/**
 * Commands that can be issued to a counter aggregate, to
 * either increment or decrement the counter value.
 */
export type CounterCommand =
  | Readonly<{ type: 'increment', name: string }>
  | Readonly<{ type: 'decrement', name: string }>

/**
 * Business requirement: counters start at 0
 */
export const initialValue = 0

/**
 * Business constraints for the counter domain.
 * Counter values are non-negative integers. Thus:
 * 1. Incrementing is always allowed
 * 2. Decrementing is only allowed when counter > 0
 */
export const decide = (value: number, { type, name }: CounterCommand): readonly CounterEvent[] => {
  switch (type) {
    case 'increment':
      return [{ type: 'incremented', name }]

    case 'decrement':
      return value > 0 ? [{ type: 'decremented', name }] : []
  }
}

/**
 * Given a {@link CounterEvent}, update the counter value.
 */
export const update = (value: number, { type }: CounterEvent): number => {
  switch (type) {
    case 'incremented':
      return value + 1

    case 'decremented':
      return value - 1
  }
}
