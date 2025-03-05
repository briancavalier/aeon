import { describe } from "node:test"
import { testRead } from "../../../test/read"
import { MemoryEventStoreClient } from "./memory-client"

describe('MemoryEventStoreClient', () => testRead(new MemoryEventStoreClient('test')))
