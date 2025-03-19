import { TransactionEvent } from "./domain"

export type TransactionCommand =
  | Readonly<{ type: 'credit', userId: string, amount: number, referenceId: string, memo: string }>
  | Readonly<{ type: 'debit', userId: string, amount: number, referenceId: string, memo: string }>

export type TransactionState = Readonly<{
  balance: number,
  transactions: readonly TransactionEvent[]
}>

export const initial: TransactionState = { balance: 0, transactions: [] }

export const decide = (state: TransactionState, command: TransactionCommand): readonly TransactionEvent[] => {
  switch (command.type) {
    case 'credit':
      return [{ ...command, type: 'credited' }]
    case 'debit':
      return state.balance < command.amount
        ? [{ ...command, type: 'debit-failed', reason: 'insufficient-funds' }]
        : [{ ...command, type: 'debited' }]
  }
}

export const update = (state: TransactionState, event: TransactionEvent): TransactionState => {
  switch (event.type) {
    case 'credited':
      return { ...state, balance: state.balance + event.amount, transactions: [...state.transactions, event] }
    case 'debited':
      return { ...state, balance: state.balance - event.amount, transactions: [...state.transactions, event] }
    case 'debit-failed':
      return state
  }
}
