export async function reduce<A, B>(i: AsyncIterable<A>, f: (b: B, a: A) => B, b: B): Promise<B> {
  for await (const a of i)
    b = f(b, a)
  return b
}

export async function first<A>(i: AsyncIterable<A>): Promise<A | undefined> {
  for await (const a of i) return a
}
