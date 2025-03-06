import { Filter, hasType } from "../filter"

export function interpretFilter<A>(filter: Filter<A>, item: any): boolean {
  if (hasType(filter)) {
    if (filter._type === 'true') return true
    if (filter._type === 'exists') return item !== undefined

    if (item === undefined) return false

    switch (filter._type) {
      case 'prefix': return typeof item === 'string' && item.startsWith(filter.value as string)
      case '=': return item === filter.value
      case '>': return item > filter.value
      case '>=': return item >= filter.value
      case '<': return item < filter.value
      case '<=': return item <= filter.value
      case '<>': return item !== filter.value
    }
  }

  return Object.entries(filter).every(([key, subFilter]) => interpretFilter(subFilter, item[key]))
}
