import { Event, Flavour } from "./domain"

export type FlavourCounts = Readonly<Record<Flavour, number>>

export const zeroFlavourCounts: FlavourCounts = {
  Vanilla: 0,
  Strawberry: 0
}

export const flavoursInStock = (c: FlavourCounts, e: Event): FlavourCounts => {
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

export const soldFlavours = (c: FlavourCounts, e: Event): FlavourCounts => {
  switch (e.type) {
    case 'FlavourSold':
      return { ...c, [e.flavour]: c[e.flavour] + 1 }

    case 'FlavourRestocked':
    case 'FlavourWentOutOfStock':
    case 'FlavourWasNotInStock':
      return c
  }
}
