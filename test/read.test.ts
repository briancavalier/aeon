import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import * as assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import { append, fromConfigString, head, read, reduce } from "../src/eventstore"

const { integrationTest } = JSON.parse(readFileSync(join(import.meta.dirname, 'test.json'), 'utf-8'))

describe(read.name, () => {
  it('given empty key, returns zero events', async () => {
    const key = `test/${Date.now()}`
    const store = fromConfigString(integrationTest.eventStoreConfig, new DynamoDBClient({}))
    const events = read(store, key)
    const count = await reduce(events, n => n + 1, 0)

    assert.equal(count, 0)
  })

  it('given key with events, returns events', async () => {
    const key = `test/${Date.now()}`
    const n = 1 + Math.floor(Math.random() * 10)
    const store = fromConfigString(integrationTest.eventStoreConfig, new DynamoDBClient({}))
    const inputEvents = Array.from({ length: n }, (_, value) => ({ type: 'test', data: { value } }))

    const result = await append(store, key, inputEvents)

    assert.equal(result.type, 'appended')

    const events = read(store, key)
    const results = await reduce(events, (results, event) => [...results, event], [] as any[])

    assert.deepEqual(results.map(({ type, data }) => ({ type, data })), inputEvents)
    results.forEach((e) => assert.equal(e.key, key))
    assert.deepEqual(results.sort((a, b) => a.revision - b.revision), results)
  })

  describe('when direction = backward', () => {
    it('given key with events, returns events in reverse order', async () => {
      const key = `test/${Date.now()}`
      const n = 1 + Math.floor(Math.random() * 10)
      const store = fromConfigString(integrationTest.eventStoreConfig, new DynamoDBClient({}))
      const inputEvents = Array.from({ length: n }, (_, value) => ({ type: 'test', data: { value } }))

      const result = await append(store, key, inputEvents)

      assert.equal(result.type, 'appended')

      const events = read(store, key)
      const results = await reduce(events, (results, event) => [...results, event], [] as any[])

      assert.deepEqual(results.map(({ type, data }) => ({ type, data })), inputEvents)
      results.forEach((e) => assert.equal(e.key, key))
      assert.deepEqual(results.sort((a, b) => b.revision - a.revision), results)
    })
  })

  describe('when start provided', () => {
    it('given key with events, returns events after start', async () => {
      const key = `test/${Date.now()}`
      const n = 1 + Math.floor(Math.random() * 10)
      const store = fromConfigString(integrationTest.eventStoreConfig, new DynamoDBClient({}))
      const initialEvents = Array.from({ length: n }, (_, value) => ({ type: 'test', data: { value } }))
      await append(store, key, initialEvents)

      const start = await head(store, key)

      const inputEvents = Array.from({ length: n }, (_, value) => ({ type: 'test', data: { value } }))
      await append(store, key, inputEvents, { expectedRevision: start })

      const events = read(store, key, { start, startExclusive: true })
      const results = await reduce(events, (results, event) => [...results, event], [] as any[])
      assert.deepEqual(results.map(({ type, data }) => ({ type, data })), inputEvents)
      results.forEach((e) => {
        assert.equal(e.key, key)
        assert.ok(e.revision > start)
      })
    })
  })
})
