import { EventStoreClient, reduce } from "../../src/eventstore"
import { Event, Flavour, Truck } from "./domain"
import { flavoursInStock, soldFlavours, zeroFlavourCounts } from "./projection"

export const flavourInStockOfTruck = async (store: EventStoreClient, truck: Truck, flavour: Flavour): Promise<number> => {
  const events = store.read<Event>(truck)

  const flavourStock = await reduce(
    events,
    (flavorCounts, { data }) => flavoursInStock(flavorCounts, data),
    zeroFlavourCounts
  )

  return flavourStock[flavour]
}

export const flavourSoldOfTruck = async (store: EventStoreClient, truck: Truck, flavour: Flavour): Promise<number> => {
  const events = store.read<Event>(truck)

  const flavourStock = await reduce(
    events,
    (flavorCounts, { data }) => soldFlavours(flavorCounts, data),
    zeroFlavourCounts
  )

  return flavourStock[flavour]
}

