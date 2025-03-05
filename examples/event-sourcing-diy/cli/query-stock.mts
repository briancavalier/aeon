#!/usr/bin/env npx tsx
import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import assert from "node:assert"
import { readFileSync } from "node:fs"
import { basename, join } from "node:path"
import { DynamoDBEventStoreClient } from "../../../src/eventstore"
import { Event, isFlavour, isTruck } from "../domain"
import { flavourInStockOfTruck } from "../query"

const { eventSourcingDIY } = JSON.parse(readFileSync(join(import.meta.dirname, '../eventstore.json'), 'utf-8'))
const store = DynamoDBEventStoreClient.fromConfigString(eventSourcingDIY.eventStoreConfig, new DynamoDBClient({}))

const [truck, flavour] = process.argv.slice(2)
assert(isTruck(truck) && isFlavour(flavour), `Usage: ${basename(process.argv[1])} <flavour> <truck>`)

flavourInStockOfTruck(store, truck, flavour)
  .then(console.log)
