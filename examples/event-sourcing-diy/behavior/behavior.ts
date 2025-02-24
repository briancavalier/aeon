import { Event, Flavour, Truck } from "../domain"

export type Command = RestockFlavour | SellFlavour

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

export type FlavourStock
  = Readonly<Record<Flavour, number>>

export const initialStock: FlavourStock = {
  Vanilla: 0,
  Chocolate: 0,
  Strawberry: 0
}

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

export const update = (stock: FlavourStock, e: Event): FlavourStock => {
  switch (e.type) {
    case 'FlavourRestocked':
      return { ...stock, [e.flavour]: stock[e.flavour] + e.quantity }

    case 'FlavourSold':
      return { ...stock, [e.flavour]: stock[e.flavour] - 1 }

    case 'FlavourWentOutOfStock':
    case 'FlavourWasNotInStock':
      return stock
  }
}
