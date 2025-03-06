import { describe, it } from 'node:test'
import * as assert from 'node:assert/strict'
import { predicate } from './filter-predicate'
import { and, or, prefix, eq, gt, gte, lt, lte, ne } from '../filter'

describe('predicate', () => {
  it('should return true for an always true filter', () => {
    const alwaysTrue = predicate({ type: 'and', value: [] })
    assert.equal(alwaysTrue({}), true)
  })

  it('should evaluate and filter correctly', () => {
    const filter = and(eq('a', 1), gt('b', 2))
    const pred = predicate(filter)

    assert.equal(pred({ a: 1, b: 3 }), true)
    assert.equal(pred({ a: 1, b: 2 }), false)
    assert.equal(pred({ a: 2, b: 3 }), false)
  })

  it('should evaluate or filter correctly', () => {
    const filter = or(eq('a', 1), gt('b', 2))
    const pred = predicate(filter)

    assert.equal(pred({ a: 1, b: 2 }), true)
    assert.equal(pred({ a: 0, b: 3 }), true)
    assert.equal(pred({ a: 0, b: 1 }), false)
  })

  it('should evaluate prefix filter correctly', () => {
    const filter = prefix('a', 'test')
    const pred = predicate(filter)

    assert.equal(pred({ a: 'test123' }), true)
    assert.equal(pred({ a: 'testing' }), true)
    assert.equal(pred({ a: 'notest' }), false)
  })

  it('should evaluate comparison filters correctly', () => {
    const eqFilter = eq('a', 1)
    const gtFilter = gt('a', 1)
    const gteFilter = gte('a', 1)
    const ltFilter = lt('a', 1)
    const lteFilter = lte('a', 1)
    const neFilter = ne('a', 1)

    assert.equal(predicate(eqFilter)({ a: 1 }), true)
    assert.equal(predicate(eqFilter)({ a: 2 }), false)

    assert.equal(predicate(gtFilter)({ a: 2 }), true)
    assert.equal(predicate(gtFilter)({ a: 1 }), false)

    assert.equal(predicate(gteFilter)({ a: 1 }), true)
    assert.equal(predicate(gteFilter)({ a: 0 }), false)

    assert.equal(predicate(ltFilter)({ a: 0 }), true)
    assert.equal(predicate(ltFilter)({ a: 1 }), false)

    assert.equal(predicate(lteFilter)({ a: 1 }), true)
    assert.equal(predicate(lteFilter)({ a: 2 }), false)

    assert.equal(predicate(neFilter)({ a: 2 }), true)
    assert.equal(predicate(neFilter)({ a: 1 }), false)
  })
})
