import { Filter } from "../filter";
import { convertToAttr, NativeAttributeValue } from '@aws-sdk/util-dynamodb';

export type DynamoDBExpression = Readonly<{
    FilterExpression?: string;
    ExpressionAttributeNames?: Record<string, string>;
    ExpressionAttributeValues?: Record<string, unknown>;
}>;

export function toFilterExpression(
    exp: Filter<string>
): DynamoDBExpression {
    const state: RenderState = { names: {}, values: {} };
    return {
        FilterExpression: render(exp, state),
        ExpressionAttributeNames: state.names,
        ExpressionAttributeValues: state.values,
    };
}

type RenderState = Readonly<{
    names: Record<string, string>;
    values: Record<string, unknown>;
}>

function render<A extends NativeAttributeValue>(e: Filter<A>, state: RenderState): string {
    let counter = 0;
    
    switch (e.type) {
        case 'and': {
            return `(${e.value.map(e => render(e, state)).join(' and ')})`;
        }
        case 'or': {
            return `(${e.value.map(e => render(e, state)).join(' or ')})`;
        }
        case 'prefix': {
            const attributePlaceholder = `#attr${counter++}`;
            state.names[attributePlaceholder] = e.attribute;
            const placeholder = `:val${counter++}`;
            state.values[placeholder] = convertToAttr(e.value);
            return `begins_with(${attributePlaceholder}, ${placeholder})`;
        }
        case 'comparison': {
            const attributePlaceholder = `#attr${counter++}`;
            state.names[attributePlaceholder] = e.attribute;
            const placeholder = `:val${counter++}`;
            state.values[placeholder] = convertToAttr(e.value);
            return `(${attributePlaceholder} ${e.operator} ${placeholder})`;
        }
    }
}
