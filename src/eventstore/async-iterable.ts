export async function* filter<A>(i: AsyncIterable<A>, f: (a: A) => boolean): AsyncIterable<A> {
  for await (const a of i)
    if (f(a)) yield a
}

export async function reduce<A, B>(i: AsyncIterable<A>, f: (b: B, a: A) => B, b: B): Promise<B> {
  for await (const a of i)
    b = f(b, a)
  return b
}