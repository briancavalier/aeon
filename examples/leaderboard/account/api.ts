import { TransactionCommand } from "./behavior"

export type TransactionResult =
  | Readonly<{ type: 'ok', transactionId: string }>
  | Readonly<{ type: 'duplicate', transactionId: string }>
  | Readonly<{ type: 'retry', transactionId: string }>
  | Readonly<{ type: 'failed', transactionId: string, reason: string }>

export type SendCommand = (c: TransactionCommand) => Promise<TransactionResult>
