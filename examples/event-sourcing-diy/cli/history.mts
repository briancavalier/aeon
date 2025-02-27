#!/usr/bin/env npx tsx
import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { fromConfigString, read, readAll } from "../../../src/eventstore"
import { isTruck } from "../domain"

const { eventSourcingDIY } = JSON.parse(readFileSync(join(import.meta.dirname, '../eventstore.json'), 'utf-8'))
const store = fromConfigString(eventSourcingDIY.eventStoreConfig, new DynamoDBClient({}))

const [truck] = process.argv.slice(2)

const history = isTruck(truck) ? read(store, truck) : readAll(store)

for await (const event of history)
  console.log(event)

