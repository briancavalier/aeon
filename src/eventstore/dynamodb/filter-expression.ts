import { NativeAttributeValue, convertToAttr } from '@aws-sdk/util-dynamodb'
import { Filter } from "../filter"

export type DynamoDBExpression = {
  readonly FilterExpression?: string
  readonly ExpressionAttributeNames?: Record<string, string>
  readonly ExpressionAttributeValues?: Record<string, unknown>
}

export function toFilterExpression(
  exp: Filter<string>
): DynamoDBExpression {
  const state: RenderState = { names: {}, values: {} }
  return {
    FilterExpression: render(exp, state),
    ExpressionAttributeNames: state.names,
    ExpressionAttributeValues: state.values,
  }
}

type RenderState = {
  readonly names: Record<string, string>
  readonly values: Record<string, unknown>
}

function render<A extends NativeAttributeValue>(e: Filter<A>, state: RenderState): string {
  let counter = 0

  switch (e.type) {
    case 'and': {
      return `(${e.value.map(e => render(e, state)).join(' and ')})`
    }
    case 'or': {
      return `(${e.value.map(e => render(e, state)).join(' or ')})`
    }
    case 'prefix': {
      const attributePlaceholder = `#attr${counter++}`
      state.names[attributePlaceholder] = e.attribute
      const placeholder = `:val${counter++}`
      state.values[placeholder] = convertToAttr(e.value)
      return `begins_with(${attributePlaceholder}, ${placeholder})`
    }
    default: {
      const attributePlaceholder = `#attr${counter++}`
      state.names[attributePlaceholder] = e.attribute
      const placeholder = `:val${counter++}`
      state.values[placeholder] = convertToAttr(e.value)
      return `(${attributePlaceholder} ${e.type} ${placeholder})`
    }
  }
}
