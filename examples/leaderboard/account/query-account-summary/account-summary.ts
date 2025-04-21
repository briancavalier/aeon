import { TransactionEvent } from "../domain"

export type AccountSummary = Readonly<{
  balance: number,
  recentTransactions: readonly TransactionEvent[]
}>

export const initial: AccountSummary = { balance: 0, recentTransactions: [] }

export const projectAccountSummary = (summary: AccountSummary, event: TransactionEvent): AccountSummary => {
  switch (event.type) {
    case 'credited':
      return {
        ...summary,
        balance: summary.balance + event.amount,
        recentTransactions: [...summary.recentTransactions, event].slice(0, 5)
      }

    case 'debited':
      return {
        ...summary,
        balance: summary.balance - event.amount,
        recentTransactions: [...summary.recentTransactions, event].slice(0, 5)
      }

    case 'transaction-failed':
      return summary
  }
}
