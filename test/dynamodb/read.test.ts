import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe } from "node:test"
import { DynamoDB } from "../../src/eventstore"
import { testRead } from "../read"

const { integrationTest } = JSON.parse(readFileSync(join(import.meta.dirname, 'test.json'), 'utf-8'))
const config = DynamoDB.parseConfig(integrationTest.eventStoreConfig)

describe('DynamoDBEventStoreClient', () => testRead(DynamoDB.fromConfig(config, new DynamoDBClient({}))))
