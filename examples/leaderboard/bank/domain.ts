export type TransactionEvent =
  | Readonly<{ type: 'credited', userId: string, amount: number, referenceId: string, memo: string }>
  | Readonly<{ type: 'debited', userId: string, amount: number, referenceId: string, memo: string }>
  | Readonly<{ type: 'debit-failed', userId: string, reason: string, amount: number, referenceId: string, memo: string }>
