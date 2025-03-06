import * as assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { describe, it } from "node:test"
import { lte } from "../src/eventstore"
import { reduce } from "../src/eventstore/async-iterable"
import { Committed, EventStoreClient } from "../src/eventstore/event-store-client"

export const testRead = (store: EventStoreClient) => {
  describe('read', () => {
    it('given empty key, returns zero events', async () => {
      const key = `test/${randomUUID()}`
      const events = store.read(key)
      const count = await reduce(events, n => n + 1, 0)

      assert.equal(count, 0)
    })

    it('given key with events, returns events', async () => {
      const key = `test/${randomUUID()}`
      const n = 1 + Math.floor(Math.random() * 10)
      const inputEvents = Array.from({ length: n }, (_, value) => ({ type: 'test', data: { value } }))

      const result = await store.append(key, inputEvents)

      assert.equal(result.type, 'appended')

      const events = store.read(key)
      const results = await reduce(events, (results, event) => [...results, event], [] as any[])

      assert.deepEqual(results.map(({ type, data }) => ({ type, data })), inputEvents)
      results.forEach((e) => assert.equal(e.key, key))
      assert.deepEqual(results.sort((a, b) => a.revision - b.revision), results)
    })

    describe('when direction = backward', () => {
      it('given key with events, returns events in reverse order', async () => {
        const key = `test/${randomUUID()}`
        const n = 1 + Math.floor(Math.random() * 10)
        const inputEvents = Array.from({ length: n }, (_, value) => ({ type: 'test', data: { value } }))

        const result = await store.append(key, inputEvents)

        assert.equal(result.type, 'appended')

        const events = store.read(key)
        const results = await reduce(events, (results, event) => [...results, event], [] as any[])

        assert.deepEqual(results.map(({ type, data }) => ({ type, data })), inputEvents)
        results.forEach((e) => assert.equal(e.key, key))
        assert.deepEqual(results.sort((a, b) => b.revision - a.revision), results)
      })
    })

    describe('when start provided', () => {
      it('given key with events, returns events after start', async () => {
        const key = `test/${randomUUID()}`
        const n = 1 + Math.floor(Math.random() * 10)
        const initialEvents = Array.from({ length: n }, (_, value) => ({ type: 'test', data: { value } }))
        await store.append(key, initialEvents)

        const start = await store.head(key)

        const inputEvents = Array.from({ length: n }, (_, value) => ({ type: 'test', data: { value } }))
        await store.append(key, inputEvents, { expectedRevision: start })

        const events = store.read(key, { start, startExclusive: true })
        const results = await reduce(events, (results, event) => [...results, event], [] as Committed<unknown>[])
        assert.deepEqual(results.map(({ type, data }) => ({ type, data })), inputEvents)
        results.forEach((e) => {
          assert.equal(e.key, key)
          assert.ok(e.revision > start)
        })
      })
    })

    describe('when filter provided', () => {
      it('given key with events, returns events matching filter', async () => {
        const key = `test/${randomUUID()}`
        const n = 10
        const initialEvents = Array.from({ length: n }, (_, value) => ({ type: `test`, data: { value } }))
        await store.append(key, initialEvents)

        const events = store.read<{ readonly value: number }>(key, { filter: { data: { value: lte(3) } } })

        const results = await reduce(events, (results, event) => [...results, event], [] as Committed<{ readonly value: number }>[])

        assert.equal(results.length, 4)
        results.forEach((e) => assert.ok(e.data.value <= 3))
      })
    })
  })
}
