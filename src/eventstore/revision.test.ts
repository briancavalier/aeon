import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { Revision, ensureInclusive, max, min, nextRevision, prevRevision } from './revision'

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

  it('given startExclusive is true, adjusts the start revision', () => {
    const range = { start: 'A' as Revision, startExclusive: true, end: 'B' as Revision }
    const result = ensureInclusive(range)
    assert.equal(result.start, nextRevision('A'))
    assert.equal(result.end, 'B')
  })

  it('given endExclusive is true, adjusts the end revision', () => {
    const range = { start: 'A' as Revision, end: 'B' as Revision, endExclusive: true }
    const result = ensureInclusive(range)
    assert.equal(result.start, 'A')
    assert.equal(result.end, prevRevision('B'))
  })

  it('given both startExclusive and endExclusive are true, adjusts both start and end revision', () => {
    const range = { start: 'A' as Revision, startExclusive: true, end: 'B' as Revision, endExclusive: true }
    const result = ensureInclusive(range)
    assert.equal(result.start, nextRevision('A'))
    assert.equal(result.end, prevRevision('B'))
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

  it('given only end is present, returns the same range', () => {
    const range = { end: 'B' as Revision }
    const result = ensureInclusive(range)
    assert.equal(result.start, min)
    assert.equal(result.end, 'B')
  })
})

describe(nextRevision.name, () => {
  it('given a base32 string, returns incremented string', () => {
    assert.equal(nextRevision('0'), '1')
    assert.equal(nextRevision('9'), 'A')
    assert.equal(nextRevision('Z'), '10')
    assert.equal(nextRevision('ZZ'), '100')
  })
})

describe(prevRevision.name, () => {
  it('given a base32 string, returns decremented string', () => {
    assert.equal(prevRevision('1'), '0')
    assert.equal(prevRevision('A'), '9')
    assert.equal(prevRevision('10'), 'Z')
    assert.equal(prevRevision('100'), 'ZZ')
  })
})
