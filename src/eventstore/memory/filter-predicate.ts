import { Filter } from '../filter'

export const always = () => true

export const predicate = <A>(f: Filter<A>): ((r: unknown) => boolean) => {
  const evaluate = (r: unknown, f: Filter<A>): boolean => {
    switch (f.type) {
      case 'and':
        return f.value.every(f => evaluate(r, f))
      case 'or':
        return f.value.some(f => evaluate(r, f))
      case 'prefix': {
        const a = typeof r === 'object' && (r as Record<string, unknown>)?.[f.attribute]
        return typeof a === 'string' && typeof f.value === 'string' && a.startsWith(f.value)
      }
      case '=':
        return (r as Record<string, any>)?.[f.attribute] === f.value
      case '>':
        return (r as Record<string, any>)?.[f.attribute] > f.value
      case '>=':
        return (r as Record<string, any>)?.[f.attribute] >= f.value
      case '<':
        return (r as Record<string, any>)?.[f.attribute] < f.value
      case '<=':
        return (r as Record<string, any>)?.[f.attribute] <= f.value
      case '<>':
        return (r as Record<string, any>)?.[f.attribute] !== f.value
    }
  }

  return (r: unknown) => evaluate(r, f)
}
