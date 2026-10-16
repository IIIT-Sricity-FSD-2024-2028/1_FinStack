import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import {
  LIVE_REFRESH_EVENT,
  createCrossTabRefreshBridge,
  createLiveRefreshController,
} from '../src/hooks/liveRefreshController.js'

class Channel {
  static channels = new Set()
  constructor(name) { this.name = name; this.onmessage = null; Channel.channels.add(this) }
  postMessage(data) {
    for (const channel of Channel.channels) {
      if (channel !== this && channel.name === this.name) channel.onmessage?.({ data })
    }
  }
  close() { Channel.channels.delete(this) }
}

function bridge(org, onChange) {
  return createCrossTabRefreshBridge({
    getOrganizationId: () => org,
    onChange,
    BroadcastChannelCtor: Channel,
  })
}

test('same-tenant tabs notify each other without broadcasting expense records or credentials', () => {
  let updatesA = 0, updatesB = 0, outsider = 0
  const first = bridge('tenant-a', () => updatesA++)
  const second = bridge('tenant-a', () => updatesB++)
  const different = bridge('tenant-b', () => outsider++)
  first.broadcast()
  assert.equal(updatesA, 0, 'sender already has local refresh event')
  assert.equal(updatesB, 1)
  assert.equal(outsider, 0, 'different tenant must never receive update signal')
  second.broadcast()
  assert.equal(updatesA, 1)
  assert.equal(updatesB, 1)
  first.close(); second.close(); different.close()
})

test('bridge validates messages and does not notify signed-out tabs', () => {
  let organizationId = 'tenant-a', updates = 0
  const receiver = createCrossTabRefreshBridge({
    getOrganizationId: () => organizationId,
    onChange: () => updates++,
    BroadcastChannelCtor: Channel,
  })
  const sender = new Channel('finstack:tenant-updates-v1')
  sender.postMessage({ kind: 'tenant-changed', organizationId: 'tenant-b' })
  sender.postMessage({ kind: 'invalid', organizationId: 'tenant-a' })
  assert.equal(updates, 0)
  organizationId = null
  sender.postMessage({ kind: 'tenant-changed', organizationId: 'tenant-a' })
  assert.equal(updates, 0)
  receiver.close(); sender.close()
})

test('change events refresh a hidden tab while periodic polling stays suspended', async () => {
  const listeners = new Map()
  const windowTarget = {
    addEventListener(type, fn) { listeners.set(type, fn) },
    removeEventListener(type) { listeners.delete(type) },
  }
  const documentTarget = { visibilityState: 'hidden', addEventListener() {}, removeEventListener() {} }
  const contexts = []
  let poll
  const controller = createLiveRefreshController({
    refresh: async (context) => contexts.push(context),
    windowTarget, documentTarget,
    setIntervalFn: (fn) => { poll = fn; return 1 },
    clearIntervalFn: () => {},
  })
  controller.start({ refreshImmediately: false })
  poll()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(contexts.length, 0)
  listeners.get(LIVE_REFRESH_EVENT)()
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(contexts, [{ background: true }])
  controller.stop()
})

test('all actors share automatic live-update hooks and successful tenant writes announce changes', async () => {
  const root = new URL('../src/', import.meta.url)
  const files = await Promise.all([
    'services/session.ts',
    'features/manager/useManagerWorkspace.js',
    'features/submitter/SubmitterContext.jsx',
    'hooks/useAsyncResource.js',
    'hooks/useEmployeePage.js',
  ].map(path => readFile(new URL(path, root), 'utf8')))
  assert.match(files[0], /announceLiveRefresh\(\)/)
  assert.match(files[0], /installCrossTabLiveRefresh/)
  for (const file of files.slice(1)) {
    assert.match(file, /useLiveRefresh|LIVE_REFRESH_EVENT/)
  }
  assert.match(files[1], /if \(background\) throw caught/)
  assert.match(files[2], /if \(background\) throw error/)
})
