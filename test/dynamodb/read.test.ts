import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe } from "node:test"
import { fromConfigString } from "../../src/eventstore/dynamodb"
import { testRead } from "../read"

const { integrationTest } = JSON.parse(readFileSync(join(import.meta.dirname, 'test.json'), 'utf-8'))

describe('DynamoDBEventStoreClient', () => testRead(fromConfigString(integrationTest.eventStoreConfig, new DynamoDBClient({}))))
