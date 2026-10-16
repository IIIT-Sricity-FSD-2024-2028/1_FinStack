export const LIVE_REFRESH_EVENT = 'finstack:live-refresh'

export function announceLiveRefresh(target = globalThis.window) {
  target?.dispatchEvent?.(new Event(LIVE_REFRESH_EVENT))
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
  let lastStartedAt = Number.NEGATIVE_INFINITY
  let timer = null

  const isVisible = () => !documentTarget || documentTarget.visibilityState !== 'hidden'

  const requestRefresh = ({ force = false } = {}) => {
    if (!active || !isVisible()) return Promise.resolve(undefined)

    if (inFlight) {
      pending = true
      return inFlight
    }

    if (!force && now() - lastStartedAt < minIntervalMs) return Promise.resolve(undefined)

    lastStartedAt = now()
    inFlight = Promise.resolve()
      .then(refresh)
      .finally(() => {
        inFlight = null
        if (active && pending && isVisible()) {
          pending = false
          requestRefresh({ force: true }).catch(() => undefined)
        }
      })

    return inFlight
  }

  const onFocus = () => requestRefresh().catch(() => undefined)
  const onVisibilityChange = () => {
    if (isVisible()) requestRefresh().catch(() => undefined)
  }
  const onMutation = () => requestRefresh({ force: true }).catch(() => undefined)

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
      if (refreshImmediately) requestRefresh({ force: true }).catch(() => undefined)
    },
    stop() {
      if (!active) return
      active = false
      pending = false
      windowTarget?.removeEventListener?.('focus', onFocus)
      windowTarget?.removeEventListener?.(LIVE_REFRESH_EVENT, onMutation)
      documentTarget?.removeEventListener?.('visibilitychange', onVisibilityChange)
      if (timer !== null) clearIntervalFn(timer)
      timer = null
    },
    refreshNow() {
      return requestRefresh({ force: true })
    },
  }
}
