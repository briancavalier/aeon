import { Event, Flavour } from "./domain"

export interface FlavorInStockOfTruck<Truck, Flavour> {
  readonly type: 'FlavorInStockOfTruck'
  readonly truck: Truck
  readonly flavour: Flavour
}

export interface FlavourSoldOfTruck<Truck, Flavour> {
  readonly type: 'FlavourSoldOfTruck'
  readonly truck: Truck
  readonly flavour: Flavour
}

export type QueryResult<A, E> = Handled<A> | QueryError<E>

export interface Handled<A> {
  readonly type: 'Handled'
  readonly result: A
}

export interface QueryError<E> {
  readonly type: 'QueryError'
  readonly error: E
}

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
