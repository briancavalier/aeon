import { AttributeValue, DynamoDBClient, QueryCommand, QueryCommandInput, QueryCommandOutput } from "@aws-sdk/client-dynamodb"

export type PaginatedQueryCommandInput = Omit<QueryCommandInput, 'ExclusiveStartKey'>

export async function* paginate(client: DynamoDBClient, limit: number, q: QueryCommandInput) {
  let k: Record<string, AttributeValue> | undefined = undefined
  do {
    const { Items, LastEvaluatedKey }: QueryCommandOutput =
      await client.send(new QueryCommand({ ...q, ExclusiveStartKey: k }))

    if (!Items) return
    else if (Items.length >= limit) return yield* Items.slice(0, limit)

    yield* Items
    limit -= Items.length
    k = LastEvaluatedKey
  } while (k && limit > 0)
}
