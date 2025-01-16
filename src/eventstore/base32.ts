const base32Chars = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"

const base32CharIndices =
  Object.fromEntries([...base32Chars].map((char, index) => [char, index]))

/**
 * Given a base32 string of arbitrary length,
 * increment it lexicographically
 */
export function nextBase32<A extends string>(p: A): A {
  // Convert prefix to an array of indices based on ULID characters
  const indices = p.split("").map(char => base32CharIndices[char])

  // Increment the prefix lexicographically
  for (let i = indices.length - 1; i >= 0; i--)
    if (indices[i] < base32Chars.length - 1) {
      indices[i]++
      for (let j = i + 1; j < indices.length; j++) indices[j] = 0
      break
    }

  return indices.map(index => base32Chars[index]).join("") as A
}
