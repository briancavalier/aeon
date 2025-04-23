import * as assert from "node:assert/strict"
import { describe, it } from "node:test"
import { interpretFilter } from "./filter-predicate.js"

describe(interpretFilter.name, () => {
  describe('_type: true', () => {
    it('should return true for true filter', () => {
      const filter = { _type: 'true' } as const
      const item = {}
      assert.strictEqual(interpretFilter(filter, item), true)
    })
  })

  describe('_type: exists', () => {
    it('should return true if the field exists', () => {
      const filter = { _type: 'exists' } as const
      const item = 'value'
      assert.strictEqual(interpretFilter(filter, item), true)
    })

    it('should return false if the field does not exist', () => {
      const filter = { _type: 'exists' } as const
      assert.strictEqual(interpretFilter(filter, undefined), false)
    })
  })

  describe('_type: prefix', () => {
    it('should return true if the field value starts with the prefix', () => {
      const filter = { _type: 'prefix', value: 'pre' } as const
      const item = 'prefixValue'
      assert.strictEqual(interpretFilter(filter, item), true)
    })

    it('should return false if the field value does not start with the prefix', () => {
      const filter = { _type: 'prefix', value: 'pre' } as const
      const item = 'value'
      assert.strictEqual(interpretFilter(filter, item), false)
    })
  })

  describe('_type: =', () => {
    it('should return true if the field value equals the filter value', () => {
      const filter = { _type: '=', value: 'value' } as const
      const item = 'value'
      assert.strictEqual(interpretFilter(filter, item), true)
    })

    it('should return false if the field value does not equal the filter value', () => {
      const filter = { _type: '=', value: 'value' } as const
      const item = 'differentValue'
      assert.strictEqual(interpretFilter(filter, item), false)
    })
  })

  describe('_type: >', () => {
    it('should return true if the field value is greater than the filter value', () => {
      const filter = { _type: '>', value: 10 } as const
      const item = 20
      assert.strictEqual(interpretFilter(filter, item), true)
    })

    it('should return false if the field value is not greater than the filter value', () => {
      const filter = { _type: '>', value: 10 } as const
      const item = 5
      assert.strictEqual(interpretFilter(filter, item), false)
    })
  })

  describe('_type: >=', () => {
    it('should return true if the field value is greater than or equal to the filter value', () => {
      const filter = { _type: '>=', value: 10 } as const
      const item = 10
      assert.strictEqual(interpretFilter(filter, item), true)
    })

    it('should return false if the field value is not greater than or equal to the filter value', () => {
      const filter = { _type: '>=', value: 10 } as const
      const item = 5
      assert.strictEqual(interpretFilter(filter, item), false)
    })
  })

  describe('_type: <', () => {
    it('should return true if the field value is less than the filter value', () => {
      const filter = { _type: '<', value: 10 } as const
      const item = 5
      assert.strictEqual(interpretFilter(filter, item), true)
    })

    it('should return false if the field value is not less than the filter value', () => {
      const filter = { _type: '<', value: 10 } as const
      const item = 20
      assert.strictEqual(interpretFilter(filter, item), false)
    })
  })

  describe('_type: <=', () => {
    it('should return true if the field value is less than or equal to the filter value', () => {
      const filter = { _type: '<=', value: 10 } as const
      const item = 10
      assert.strictEqual(interpretFilter(filter, item), true)
    })

    it('should return false if the field value is not less than or equal to the filter value', () => {
      const filter = { _type: '<=', value: 10 } as const
      const item = 20
      assert.strictEqual(interpretFilter(filter, item), false)
    })
  })

  describe('_type: <>', () => {
    it('should return true if the field value is not equal to the filter value', () => {
      const filter = { _type: '<>', value: 'value' } as const
      const item = 'differentValue'
      assert.strictEqual(interpretFilter(filter, item), true)
    })

    it('should return false if the field value is equal to the filter value', () => {
      const filter = { _type: '<>', value: 'value' } as const
      const item = 'value'
      assert.strictEqual(interpretFilter(filter, item), false)
    })
  })

  describe('_type: and', () => {
    it('should return true if all filters are true', () => {
      const filter = { _type: 'and', filters: [{ _type: '>', value: 0 }, { _type: '<', value: 100 }] } as const
      const item = 10
      assert.strictEqual(interpretFilter(filter, item), true)
    })

    it('should return false if any filter is false', () => {
      const filter = { _type: 'and', filters: [{ _type: '>', value: 0 }, { _type: '<', value: 10 }] } as const
      const item = 10
      assert.strictEqual(interpretFilter(filter, item), false)
    })
  })

  describe('_type: or', () => {
    it('should return true if any filter is true', () => {
      const filter = { _type: 'or', filters: [{ _type: '<=', value: 10 }, { _type: '>', value: 100 }] } as const
      const item = 10
      assert.strictEqual(interpretFilter(filter, item), true)
    })
    it('should return false if all filters are false', () => {
      const filter = { _type: 'or', filters: [{ _type: '<', value: 10 }, { _type: '>', value: 100 }] } as const
      const item = 10
      assert.strictEqual(interpretFilter(filter, item), false)
    })
  })

  describe('complex filters', () => {
    it('should handle nested object fields', () => {
      const filter = { nested: { field: { _type: '=', value: 'value' } } } as const
      const item = { nested: { field: 'value' } }
      assert.strictEqual(interpretFilter(filter, item), true)
    })

    it('should handle multiple nested object fields', () => {
      const filter = { nested: { field: { _type: '=', value: 'value' } } } as const
      const item = { nested: { field: 'value' } }
      assert.strictEqual(interpretFilter(filter, item), true)
    })

    it('should return false for non-matching nested object fields', () => {
      const filter = { nested: { _type: '=', value: 'value' } } as const
      const item = { nested: { field: 'differentValue' } }
      assert.strictEqual(interpretFilter(filter, item), false)
    })

    it('should return false for non-matching multiple nested object fields', () => {
      const filter = { nested: { field: { _type: '=', value: 'value' } } } as const
      const item = { nested: { field: 'differentValue' } }
      assert.strictEqual(interpretFilter(filter, item), false)
    })
  })
})
