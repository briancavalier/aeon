export type Event =
  | FlavourRestocked
  | FlavourSold
  | FlavourWentOutOfStock
  | FlavourWasNotInStock

export type Flavour = 'Vanilla' | 'Chocolate' | 'Strawberry'

export interface FlavourRestocked {
  readonly type: 'FlavourRestocked'
  readonly Flavour: Flavour
  readonly quantity: number
}

export interface FlavourSold {
  readonly type: 'FlavourSold'
  readonly Flavour: Flavour
}

export interface FlavourWentOutOfStock {
  readonly type: 'FlavourWentOutOfStock'
  readonly Flavour: Flavour
}

export interface FlavourWasNotInStock {
  readonly type: 'FlavourNotInStock'
  readonly Flavour: Flavour
}
