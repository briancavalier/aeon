import { AttributeValue } from '@aws-sdk/client-dynamodb'
import { marshall } from '@aws-sdk/util-dynamodb'
import { Filter, hasType } from "../filter"

export type DynamoDBExpression = {
  readonly FilterExpression?: string
  readonly ExpressionAttributeNames?: Record<string, string>
  readonly ExpressionAttributeValues?: Record<string, AttributeValue>
}

export function toFilterExpression<A>(
  filter: Filter<A>
): DynamoDBExpression {
  let counter = 0
  const values: Record<string, A> = {}
  const names: Record<string, string> = {}

  function traverse(filter: Filter<A>, path: string[] = []): string | undefined {
    if (hasType(filter)) {
      if (filter._type === 'true') return undefined

      const attributePath = path.map((part) => {
        const placeholder = `#${part}`
        names[placeholder] = part
        return placeholder
      }).join('.')

      if (filter._type === 'exists') return `attribute_exists(${attributePath})`

      const placeholder = `:val${counter++}`
      values[placeholder] = filter.value

      switch (filter._type) {
        case 'prefix': return `begins_with(${attributePath}, ${placeholder})`
        default: return `${attributePath} ${filter._type} ${placeholder}`
      }
    }

    const expressions: string[] = []
    for (const [key, subFilter] of Object.entries(filter)) {
      const subExpression = traverse(subFilter, [...path, key])
      if (subExpression) expressions.push(subExpression)
    }

    return expressions.length > 0 ? expressions.join(' AND ') : undefined
  }

  return {
    FilterExpression: traverse(filter),
    ExpressionAttributeValues: marshall(values, { removeUndefinedValues: true }),
    ExpressionAttributeNames: names
  }
}
