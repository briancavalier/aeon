import { AttributeValue, DynamoDBClient, QueryCommand, QueryCommandInput, QueryCommandOutput } from "@aws-sdk/client-dynamodb"

export type PaginatedQueryCommandInput = Omit<QueryCommandInput, 'ExclusiveStartKey'>

export async function* paginate(client: DynamoDBClient, limit: number, q: QueryCommandInput) {
  let token: Record<string, AttributeValue> | undefined = undefined
  do {
    const { Items, LastEvaluatedKey }: QueryCommandOutput =
        await client.send(new QueryCommand({ Limit: limit, ...q, ExclusiveStartKey: token }))
    
    if (!Items) return
    else if(Items.length >= limit) return yield* Items.slice(0, limit)

    yield* Items
    limit -= Items.length
    token = LastEvaluatedKey
  } while (token && limit > 0)
}