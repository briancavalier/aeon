#!/usr/bin/env npx tsx
import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import assert from "node:assert"
import { readFileSync } from "node:fs"
import { basename, join } from "node:path"
import { fromConfigString } from "../../../src/eventstore"
import { isFlavour, isTruck } from "../domain"
import { handleQuery } from "../query/handler"

const { eventSourcingDIY } = JSON.parse(readFileSync(join(import.meta.dirname, '../eventstore.json'), 'utf-8'))
const store = fromConfigString(eventSourcingDIY.eventStoreConfig, new DynamoDBClient({}))

const [flavour, truck] = process.argv.slice(2)
assert(isTruck(truck) && isFlavour(flavour), `Usage: ${basename(process.argv[1])} <flavour> <truck>`)

handleQuery
  (store, { type: 'FlavourSoldOfTruck', truck, flavour })
  .then(result => console.log(result))
