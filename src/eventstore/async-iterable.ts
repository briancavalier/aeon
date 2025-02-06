export async function reduce<A, B>(i: AsyncIterable<A>, f: (b: B, a: A) => B, b: B): Promise<B> {
  for await (const a of i)
    b = f(b, a)
  return b
}