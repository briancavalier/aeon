import { AppendResult, EventStoreClient, reduce } from "../../src/eventstore"
import { Event, Flavour, Truck } from "./domain"
import { FlavourCounts, flavoursInStock, zeroFlavourCounts } from "./projection"

export type Command =
  | RestockFlavour
  | SellFlavour

export interface RestockFlavour {
  readonly type: 'RestockFlavour'
  readonly truck: Truck
  readonly flavour: Flavour
  readonly quantity: number
}

export interface SellFlavour {
  readonly type: 'SellFlavour'
  readonly truck: Truck
  readonly flavour: Flavour
}

export type FlavourStock = FlavourCounts

export const initialStock = zeroFlavourCounts

/**
 * The "behavior", i.e. business logic: given a command and the
 * current stock of a truck, decide the resulting events.
 */
export const decide = (stock: FlavourStock, c: Command): readonly Event[] => {
  switch (c.type) {
    case 'RestockFlavour':
      return [{ ...c, type: 'FlavourRestocked' }]

    case 'SellFlavour': {
      const currentStock = stock[c.flavour]
      return currentStock === 0
        ? [{ ...c, type: 'FlavourWasNotInStock' }]
        : currentStock === 1
          ? [{ ...c, type: 'FlavourSold' }, { ...c, type: 'FlavourWentOutOfStock' }]
          : [{ ...c, type: 'FlavourSold' }]
    }
  }
}

export const handleCommand = async (store: EventStoreClient, command: Command): Promise<AppendResult> => {
  const revision = await store.head(command.truck)
  const history = store.read<Event>(command.truck, { end: revision })

  const stock = await reduce(history, (stock, { data }) => flavoursInStock(stock, data), initialStock)

  const events = decide(stock, command)

  return store.append(
    command.truck,
    events.map(data => ({ type: data.type, data })),
    { expectedRevision: revision }
  )
}
