#!/usr/bin/env npx tsx
import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import assert from "node:assert"
import { readFileSync } from "node:fs"
import { basename, join } from "node:path"
import { DynamoDBEventStoreClient } from "../../../src/eventstore"
import { handleCommand } from "../behavior"
import { Event, isFlavour, isTruck } from "../domain"

const { eventSourcingDIY } = JSON.parse(readFileSync(join(import.meta.dirname, '../eventstore.json'), 'utf-8'))
const store = DynamoDBEventStoreClient.fromConfigString(eventSourcingDIY.eventStoreConfig, new DynamoDBClient({}))

const [truck, flavour, quantityString] = process.argv.slice(2)
const quantity = Number.parseInt(quantityString)
assert(isTruck(truck) && isFlavour(flavour) && Number.isInteger(quantity), `Usage: ${basename(process.argv[1])} <flavour> <quantity> <truck>`)

handleCommand
  (store, { type: 'RestockFlavour', truck, flavour, quantity })
  .then(result => console.log(result))
