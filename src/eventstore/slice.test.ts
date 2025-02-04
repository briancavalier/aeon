import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { Position } from './position'
import { getSlice, Slice, sliceEnd, sliceStart } from './slice'

describe(getSlice.name, () => {
  it('given a position, returns the initial characters of the position', () => {
    const position = '0123456789ABCDE' as Position
    const slice = getSlice(position)
    assert.equal(slice, '01234')
  })
})

describe(sliceStart.name, () => {
  it('given a slice, returns the slice padded to the right with zeros', () => {
    const slice = '01234' as Slice
    const position = sliceStart(slice)
    assert.equal(position, `${slice}000000000000000000000`)
  })
})

describe(sliceEnd.name, () => {
  it('given a slice, returns the slice padded to the right with Zs', () => {
    const slice = '01234' as Slice
    const position = sliceEnd(slice)
    assert.equal(position, `${slice}ZZZZZZZZZZZZZZZZZZZZZ`)
  })
})