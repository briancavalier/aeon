export type TransactionEvent =
  | Readonly<{ type: 'credited', userId: string, amount: number, transactionId: string, memo: string }>
  | Readonly<{ type: 'debited', userId: string, amount: number, transactionId: string, memo: string }>
  | Readonly<{ type: 'transaction-failed', userId: string, reason: string, amount: number, transactionId: string, memo: string }>
