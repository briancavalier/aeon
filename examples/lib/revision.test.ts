import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { Position } from '../../src/eventstore'
import { hasSeenRevision, Revision } from './revision'
describe(hasSeenRevision.name, () => {
  it('given current revision has seen the requested revision, returns true', () => {
    const current: Revision = { a: '2' as Position, b: '3' as Position }
    const requested: Revision = { a: '1' as Position, b: '2' as Position }
    assert(hasSeenRevision(current, requested))
  })

  it('given current revision has not seen the requested revision, returns false', () => {
    const current: Revision = { a: '1' as Position, b: '2' as Position }
    const requested: Revision = { a: '2' as Position, b: '3' as Position }
    assert(!hasSeenRevision(current, requested))
  })

  it('given current revision has extra keys not in requested revision, returns true', () => {
    const current: Revision = { a: '2' as Position, b: '3' as Position, c: '4' as Position }
    const requested: Revision = { a: '1' as Position, b: '2' as Position }
    assert(hasSeenRevision(current, requested))
  })

  it('given requested revision has keys not in current revision, returns false', () => {
    const current: Revision = { a: '2' as Position }
    const requested: Revision = { a: '1' as Position, b: '2' as Position }
    assert(!hasSeenRevision(current, requested))
  })

  it('given both current and requested revisions are empty, returns true', () => {
    const current: Revision = {}
    const requested: Revision = {}
    assert(hasSeenRevision(current, requested))
  })

  it('given current revision is equivalent to requested revision, returns true', () => {
    const current: Revision = { a: '2' as Position, b: '3' as Position }
    const requested: Revision = { a: '2' as Position, b: '3' as Position }
    assert(hasSeenRevision(current, requested))
  })
})
