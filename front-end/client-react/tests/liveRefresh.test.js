import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  LIVE_REFRESH_EVENT,
  createLiveRefreshController,
} from '../src/hooks/liveRefreshController.js'

class EventTargetStub {
  constructor() {
    this.listeners = new Map()
    this.visibilityState = 'visible'
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || new Set()
    listeners.add(listener)
    this.listeners.set(type, listeners)
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener)
  }

  dispatch(type) {
    for (const listener of this.listeners.get(type) || []) listener({ type })
  }

  listenerCount(type) {
    return this.listeners.get(type)?.size || 0
  }
}

const tick = () => new Promise((resolve) => setImmediate(resolve))

test('refreshes on focus and when a hidden tab becomes visible', async () => {
  const windowTarget = new EventTargetStub()
  const documentTarget = new EventTargetStub()
  let calls = 0
  let time = 1_000
  const controller = createLiveRefreshController({
    refresh: () => { calls += 1 },
    windowTarget,
    documentTarget,
    pollIntervalMs: 0,
    minIntervalMs: 0,
    now: () => time++,
  })

  controller.start({ refreshImmediately: false })
  windowTarget.dispatch('focus')
  await tick()
  assert.equal(calls, 1)

  documentTarget.visibilityState = 'hidden'
  documentTarget.dispatch('visibilitychange')
  await tick()
  assert.equal(calls, 1)

  documentTarget.visibilityState = 'visible'
  documentTarget.dispatch('visibilitychange')
  await tick()
  assert.equal(calls, 2)
  controller.stop()
})

test('coalesces overlapping refresh requests and runs one trailing refresh', async () => {
  const windowTarget = new EventTargetStub()
  const documentTarget = new EventTargetStub()
  const resolvers = []
  let calls = 0
  const controller = createLiveRefreshController({
    refresh: () => {
      calls += 1
      return new Promise((resolve) => resolvers.push(resolve))
    },
    windowTarget,
    documentTarget,
    pollIntervalMs: 0,
    minIntervalMs: 0,
  })

  controller.start()
  await tick()
  windowTarget.dispatch('focus')
  windowTarget.dispatch(LIVE_REFRESH_EVENT)
  assert.equal(calls, 1)

  resolvers.shift()()
  await tick()
  assert.equal(calls, 2)
  resolvers.shift()()
  await tick()
  controller.stop()
})

test('stops polling and removes all listeners on cleanup', async () => {
  const windowTarget = new EventTargetStub()
  const documentTarget = new EventTargetStub()
  let intervalCallback
  let clearedTimer
  let calls = 0
  const controller = createLiveRefreshController({
    refresh: () => { calls += 1 },
    windowTarget,
    documentTarget,
    setIntervalFn: (callback) => { intervalCallback = callback; return 42 },
    clearIntervalFn: (timer) => { clearedTimer = timer },
  })

  controller.start({ refreshImmediately: false })
  assert.equal(windowTarget.listenerCount('focus'), 1)
  assert.equal(documentTarget.listenerCount('visibilitychange'), 1)
  intervalCallback()
  await tick()
  assert.equal(calls, 1)

  controller.stop()
  assert.equal(clearedTimer, 42)
  assert.equal(windowTarget.listenerCount('focus'), 0)
  assert.equal(windowTarget.listenerCount(LIVE_REFRESH_EVENT), 0)
  assert.equal(documentTarget.listenerCount('visibilitychange'), 0)
  windowTarget.dispatch('focus')
  await tick()
  assert.equal(calls, 1)
})
