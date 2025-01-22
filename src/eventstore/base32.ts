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
  for (let i = indices.length - 1; i >= 0; i--) {
    if (indices[i] < base32Chars.length - 1) {
      indices[i]++
      for (let j = i + 1; j < indices.length; j++) indices[j] = 0

      return indices.map(index => base32Chars[index]).join("") as A
    }
  }

  // If all characters were 'Z', we need to add a new '1' at the beginning
  return '1' + indices.map(() => base32Chars[0]).join("") as A
}

/**
 * Given a base32 string of arbitrary length,
 * decrement it lexicographically
 */
export function prevBase32<A extends string>(p: A): A {
  // Convert prefix to an array of indices based on ULID characters
  const indices = p.split("").map(char => base32CharIndices[char])
  const last = base32Chars.length - 1

  // Decrement the prefix lexicographically
  for (let i = indices.length - 1; i >= 0; i--) {
    if (indices[i] > 0) {
      indices[i]--
      for (let j = i + 1; j < indices.length; j++) indices[j] = last

      const result = indices.map(index => base32Chars[index]).join("").replace(/^0+/, '')
      return (result || '0') as A
    }
  }

  // If all characters were '0', we need to remove the leading '1'
  const result = indices.length > 1
    ? indices.slice(1).map(() => base32Chars[last]).join("").replace(/^0+/, '')
    : ''

  return (result || '0') as A
}
