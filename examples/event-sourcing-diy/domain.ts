export type Event =
  | FlavourRestocked
  | FlavourSold
  | FlavourWentOutOfStock
  | FlavourWasNotInStock

export type Truck = `truck/${number}`

export type Flavour = 'Vanilla' | 'Chocolate' | 'Strawberry'

export interface FlavourRestocked {
  readonly type: 'FlavourRestocked'
  readonly flavour: Flavour
  readonly quantity: number
}

export interface FlavourSold {
  readonly type: 'FlavourSold'
  readonly flavour: Flavour
}

export interface FlavourWentOutOfStock {
  readonly type: 'FlavourWentOutOfStock'
  readonly flavour: Flavour
}

export interface FlavourWasNotInStock {
  readonly type: 'FlavourWasNotInStock'
  readonly flavour: Flavour
}
