import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { Revision } from './revision'
import { getSlice, Slice, sliceEnd, sliceStart } from './slice'

describe(getSlice.name, () => {
  it('given a revision, returns the initial characters of the revision', () => {
    const revision = '0123456789ABCDE' as Revision
    const slice = getSlice(revision)
    assert.equal(slice, '01234')
  })
})

describe(sliceStart.name, () => {
  it('given a slice, returns the slice padded to the right with zeros', () => {
    const slice = '01234' as Slice
    const revision = sliceStart(slice)
    assert.equal(revision, `${slice}000000000000000000000`)
  })
})

describe(sliceEnd.name, () => {
  it('given a slice, returns the slice padded to the right with Zs', () => {
    const slice = '01234' as Slice
    const revision = sliceEnd(slice)
    assert.equal(revision, `${slice}ZZZZZZZZZZZZZZZZZZZZZ`)
  })
})