import { TransactionEvent } from "./domain"

export type TransactionCommand = CreditCommand | DebitCommand

export type CreditCommand = Readonly<{ type: 'credit', userId: string, amount: number, transactionId: string, memo: string }>
export type DebitCommand = Readonly<{ type: 'debit', userId: string, amount: number, transactionId: string, memo: string }>

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
        ? [{ ...command, type: 'transaction-failed', reason: 'insufficient-funds' }]
        : [{ ...command, type: 'debited' }]
  }
}

export const update = (state: TransactionState, event: TransactionEvent): TransactionState => {
  switch (event.type) {
    case 'credited':
      return { ...state, balance: state.balance + event.amount, transactions: [...state.transactions, event] }
    case 'debited':
      return { ...state, balance: state.balance - event.amount, transactions: [...state.transactions, event] }
    case 'transaction-failed':
      return state
  }
}
