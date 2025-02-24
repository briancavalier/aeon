import { Revision } from "../../../src/eventstore"
import { Event, Flavour, Truck, isFlavour, isTruck } from "../domain"

export interface Result<A> {
  readonly type: 'Result'
  readonly value: A
}

export interface RetryAfter {
  readonly type: 'RetryAfter'
  readonly requested: Revision,
  readonly latest: Revision,
  readonly seconds: number
}

export type QueryResult<A, E> =
  | Result<A>
  | RetryAfter

export type Query = FlavourInStockOfTruck | FlavourSoldOfTruck

export interface FlavourInStockOfTruck {
  readonly type: 'FlavourInStockOfTruck'
  readonly truck: Truck
  readonly flavour: Flavour
}

export interface FlavourSoldOfTruck {
  readonly type: 'FlavourSoldOfTruck'
  readonly truck: Truck
  readonly flavour: Flavour
}

export const isQuery = (x: unknown): x is Query =>
  !!x && typeof x === 'object' &&
  ((x as Query).type === 'FlavourInStockOfTruck' || (x as Query).type === 'FlavourSoldOfTruck') &&
  typeof (x as Query).truck === 'string' && isTruck((x as Query).truck) &&
  typeof (x as Query).flavour === 'string' && isFlavour((x as Query).flavour)

export type FlavourCounts
  = Readonly<Record<Flavour, number>>

export const zeroFlavourCounts: FlavourCounts = {
  Vanilla: 0,
  Chocolate: 0,
  Strawberry: 0
}

export const projectStock = (c: FlavourCounts, e: Event): FlavourCounts => {
  switch (e.type) {
    case 'FlavourRestocked':
      return { ...c, [e.flavour]: c[e.flavour] + e.quantity }

    case 'FlavourSold':
      return { ...c, [e.flavour]: c[e.flavour] - 1 }

    case 'FlavourWentOutOfStock':
    case 'FlavourWasNotInStock':
      return c
  }
}

export const projectSold = (c: FlavourCounts, e: Event): FlavourCounts => {
  switch (e.type) {
    case 'FlavourSold':
      return { ...c, [e.flavour]: c[e.flavour] + 1 }

    case 'FlavourRestocked':
    case 'FlavourWentOutOfStock':
    case 'FlavourWasNotInStock':
      return c
  }
}
