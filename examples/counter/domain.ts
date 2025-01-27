export type CounterEvent = CounterIncrementedEvent | CounterDecrementedEvent

export type CounterIncrementedEvent = Readonly<{
  type: 'incremented',
  key: `counter/${string}`,
}>

export type CounterDecrementedEvent = Readonly<{
  type: 'decremented',
  key: `counter/${string}`,
}>

export type CounterCommand = CounterIncrementCommand | CounterDecrementCommand

export type CounterIncrementCommand = Readonly<{
  type: 'increment',
  key: string,
}>

export type CounterDecrementCommand = Readonly<{
  type: 'decrement',
  key: string,
}>

/**
 * Business requiremnt: counters start at 0
 */
export const initialValue = 0

/**
 * Business logic for the counter domain. Business requirements:
 * 1. Counter values are non-negative integers, thus
 * 2. Incrementing is always allowed
 * 3. Decrementing is only allowed if the counter > zero
 */
export const decide = (value: number, { type, key }: CounterCommand): readonly CounterEvent[] => {
  switch (type) {
    case 'increment':
      return [{ type: 'incremented', key: `counter/${key}` }]

    case 'decrement':
      return value > 0 ? [{ type: 'decremented', key: `counter/${key}` }] : []
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
