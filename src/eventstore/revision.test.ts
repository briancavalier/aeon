import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { nextBase32, prevBase32 } from './base32'
import { ensureInclusive, max, min, Revision } from './revision'

describe(ensureInclusive.name, () => {
  it('given startExclusive and endExclusive are not set, returns the same range', () => {
    const range = { start: 'A' as Revision, end: 'B' as Revision }
    const result = ensureInclusive(range)
    assert.deepEqual(result, {
      ...range,
      limit: Infinity,
      direction: 'forward'
    })
  })

  it('given startExclusive is true, adjusts the start position', () => {
    const range = { start: 'A' as Revision, startExclusive: true, end: 'B' as Revision }
    const result = ensureInclusive(range)
    assert.equal(result.start, nextBase32('A'))
    assert.equal(result.end, 'B')
  })

  it('given endExclusive is true, adjusts the end position', () => {
    const range = { start: 'A' as Revision, end: 'B' as Revision, endExclusive: true }
    const result = ensureInclusive(range)
    assert.equal(result.start, 'A')
    assert.equal(result.end, prevBase32('B'))
  })

  it('given both startExclusive and endExclusive are true, adjusts both start and end positions', () => {
    const range = { start: 'A' as Revision, startExclusive: true, end: 'B' as Revision, endExclusive: true }
    const result = ensureInclusive(range)
    assert.equal(result.start, nextBase32('A'))
    assert.equal(result.end, prevBase32('B'))
  })

  it('given both start and end are omitted, returns the same range', () => {
    const range = {}
    const result = ensureInclusive(range)
    assert.equal(result.start, min)
    assert.equal(result.end, max)
  })

  it('given only start is present, returns the same range', () => {
    const range = { start: 'A' as Revision }
    const result = ensureInclusive(range)
    assert.equal(result.start, 'A')
    assert.equal(result.end, max)
  })

  it.only('given only end is present, returns the same range', () => {
    const range = { end: 'B' as Revision }
    const result = ensureInclusive(range)
    assert.equal(result.start, min)
    assert.equal(result.end, 'B')
  })
})
