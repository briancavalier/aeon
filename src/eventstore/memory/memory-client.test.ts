import * as assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { EventEmitter } from "node:events"
import { describe, it } from "node:test"
import { testRead } from "../../../test/read"
import { Notification } from "../notification"
import { MemoryEventStoreClient } from "./memory-client"

describe('MemoryEventStoreClient', () => {
  testRead(new MemoryEventStoreClient('test'))

  describe('notifications', () => {
    it('notifies when events are appended', async () => {
      const emitter = new EventEmitter<{ appended: [Notification] }>()
      const store = new MemoryEventStoreClient('test', emitter)

      const n = 1 + Math.floor(Math.random() * 10)

      const key1 = `test/${randomUUID()}`
      const inputEvents1 = Array.from({ length: n }, (_, value) => ({ type: 'test', data: { value } }))
      const promise1 = new Promise<Notification>((resolve) => emitter.once('appended', resolve))

      await store.append(key1, inputEvents1)

      const notification1 = await promise1

      assert.deepEqual(
        notification1.events,
        inputEvents1.map(() => ({ key: key1, type: 'test' }))
      )

      const key2 = `test/${randomUUID()}`
      const inputEvents2 = Array.from({ length: n }, (_, value) => ({ type: 'test', data: { value } }))
      const promise2 = new Promise<Notification>((resolve) => emitter.once('appended', resolve))

      await store.append(key2, inputEvents2)

      const notification2 = await promise2

      assert.deepEqual(
        notification2.events,
        inputEvents2.map(() => ({ key: key2, type: 'test' }))
      )
    })

    it('batches notifications when events appended', async () => {
      const emitter = new EventEmitter<{ appended: [Notification] }>()
      const store = new MemoryEventStoreClient('test', emitter)

      const n = 1 + Math.floor(Math.random() * 10)

      const key1 = `test/${randomUUID()}`
      const inputEvents1 = Array.from({ length: n }, (_, value) => ({ type: 'test', data: { value } }))
      const promise = new Promise<Notification>((resolve) => emitter.once('appended', resolve))

      await store.append(key1, inputEvents1)

      const key2 = `test/${randomUUID()}`
      const inputEvents2 = Array.from({ length: n }, (_, value) => ({ type: 'test', data: { value } }))

      await store.append(key2, inputEvents2)

      const notification = await promise

      const expected = [
        ...inputEvents1.map(() => ({ key: key1, type: 'test' })),
        ...inputEvents2.map(() => ({ key: key2, type: 'test' }))
      ]

      assert.deepEqual(notification.events, expected)
    })
  })
})
