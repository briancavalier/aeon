import { AppendResult } from "../../../src"
import { TransactionCommand } from "./behavior"

export type SendCommand = (c: TransactionCommand) => Promise<AppendResult>
