import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { nextBase32, prevBase32 } from './base32'

describe(nextBase32.name, () => {
  it('given a base32 string, returns incremented string', () => {
    assert.equal(nextBase32('0'), '1')
    assert.equal(nextBase32('9'), 'A')
    assert.equal(nextBase32('Z'), '10')
    assert.equal(nextBase32('ZZ'), '100')
  })
})

describe(prevBase32.name, () => {
  it('given a base32 string, returns decremented string', () => {
    assert.equal(prevBase32('1'), '0')
    assert.equal(prevBase32('A'), '9')
    assert.equal(prevBase32('10'), 'Z')
    assert.equal(prevBase32('100'), 'ZZ')
  })
})
