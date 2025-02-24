import { EventStoreClient, Revision, head, read, reduce } from '../../../src/eventstore'
import { Event } from '../domain'
import { Query, projectSold, projectStock, zeroFlavourCounts } from './query'

export const handleQuery = async (store: EventStoreClient, query: Query, requested?: Revision) => {
  const latest = await head(store, query.truck)
  if (requested && latest < requested)
    return { type: 'RetryAfter', latest, requested, retryAfterSeconds: 3 } as const

  const events = read<Event>(store, query.truck)

  switch (query.type) {
    case 'FlavourInStockOfTruck': {
      const flavourStock = await reduce(
        events,
        (flavorCounts, { data }) => projectStock(flavorCounts, data),
        zeroFlavourCounts
      )
      return {
        type: 'Result',
        value: flavourStock[query.flavour]
      } as const
    }

    case 'FlavourSoldOfTruck': {
      const flavourSales = await reduce(
        events,
        (flavorCounts, { data }) => projectSold(flavorCounts, data),
        zeroFlavourCounts
      )
      return {
        type: 'Result',
        value: flavourSales[query.flavour]
      } as const
    }
  }
}
