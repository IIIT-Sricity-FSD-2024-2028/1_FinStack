export const LIVE_REFRESH_EVENT = 'finstack:live-refresh'
export const CROSS_TAB_CHANNEL = 'finstack:tenant-updates-v1'

let installedBridge = null

// Cross-tab messages contain only a tenant identifier and a change signal.
// Each receiving tab makes its own role-scoped authenticated API request.
export function createCrossTabRefreshBridge({
  getOrganizationId,
  onChange,
  BroadcastChannelCtor = globalThis.BroadcastChannel,
}) {
  const noop = { broadcast() {}, close() {} }
  if (typeof BroadcastChannelCtor !== 'function') return noop
  let channel
  try {
    channel = new BroadcastChannelCtor(CROSS_TAB_CHANNEL)
  } catch {
    return noop
  }
  channel.onmessage = (event) => {
    const organizationId = getOrganizationId?.()
    if (organizationId && event?.data?.kind === 'tenant-changed' &&
        event.data.organizationId === organizationId) {
      onChange()
    }
  }
  return {
    broadcast() {
      const organizationId = getOrganizationId?.()
      if (!organizationId) return
      try {
        channel.postMessage({ kind: 'tenant-changed', organizationId })
      } catch {
        // A notification failure must not turn a successful API write into an error.
      }
    },
    close() {
      channel.onmessage = null
      channel.close()
    },
  }
}

export function installCrossTabLiveRefresh(getOrganizationId, target = globalThis.window) {
  installedBridge?.close()
  installedBridge = createCrossTabRefreshBridge({
    getOrganizationId,
    onChange: () => target?.dispatchEvent?.(new Event(LIVE_REFRESH_EVENT)),
  })
}

export function announceLiveRefresh(target = globalThis.window) {
  target?.dispatchEvent?.(new Event(LIVE_REFRESH_EVENT))
  installedBridge?.broadcast()
}

export function createLiveRefreshController({
  refresh,
  windowTarget = globalThis.window,
  documentTarget = globalThis.document,
  pollIntervalMs = 15_000,
  minIntervalMs = 750,
  now = Date.now,
  setIntervalFn = globalThis.setInterval,
  clearIntervalFn = globalThis.clearInterval,
}) {
  let active = false
  let inFlight = null
  let pending = false
  let pendingBackground = true
  let pendingAllowHidden = false
  let lastStartedAt = Number.NEGATIVE_INFINITY
  let timer = null

  const isVisible = () => !documentTarget || documentTarget.visibilityState !== 'hidden'

  const requestRefresh = ({ force = false, background = true, allowHidden = false } = {}) => {
    if (!active || (!allowHidden && !isVisible())) return Promise.resolve(undefined)

    if (inFlight) {
      pending = true
      pendingBackground = pendingBackground && background
      pendingAllowHidden = pendingAllowHidden || allowHidden
      return inFlight
    }

    if (!force && now() - lastStartedAt < minIntervalMs) return Promise.resolve(undefined)

    lastStartedAt = now()
    inFlight = Promise.resolve()
      .then(() => refresh({ background }))
      .finally(() => {
        inFlight = null
        if (active && pending && (pendingAllowHidden || isVisible())) {
          const nextBackground = pendingBackground
          const nextAllowHidden = pendingAllowHidden
          pending = false
          pendingBackground = true
          pendingAllowHidden = false
          requestRefresh({ force: true, background: nextBackground, allowHidden: nextAllowHidden }).catch(() => undefined)
        }
      })

    return inFlight
  }

  const onFocus = () => requestRefresh().catch(() => undefined)
  const onVisibilityChange = () => {
    if (isVisible()) requestRefresh().catch(() => undefined)
  }
  const onMutation = () => requestRefresh({ force: true, allowHidden: true }).catch(() => undefined)

  return {
    start({ refreshImmediately = true } = {}) {
      if (active) return
      active = true
      windowTarget?.addEventListener?.('focus', onFocus)
      windowTarget?.addEventListener?.(LIVE_REFRESH_EVENT, onMutation)
      documentTarget?.addEventListener?.('visibilitychange', onVisibilityChange)
      if (pollIntervalMs > 0) {
        timer = setIntervalFn(() => requestRefresh().catch(() => undefined), pollIntervalMs)
      }
      if (refreshImmediately) {
        requestRefresh({ force: true, background: false }).catch(() => undefined)
      }
    },
    stop() {
      if (!active) return
      active = false
      pending = false
      pendingBackground = true
      pendingAllowHidden = false
      windowTarget?.removeEventListener?.('focus', onFocus)
      windowTarget?.removeEventListener?.(LIVE_REFRESH_EVENT, onMutation)
      documentTarget?.removeEventListener?.('visibilitychange', onVisibilityChange)
      if (timer !== null) clearIntervalFn(timer)
      timer = null
    },
    refreshNow() {
      return requestRefresh({ force: true })
    },
    retryNow() {
      return requestRefresh({ force: true, background: false })
    },
  }
}
