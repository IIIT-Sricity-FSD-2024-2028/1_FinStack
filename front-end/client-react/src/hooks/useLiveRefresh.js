import { useCallback, useEffect, useRef } from 'react'
import { createLiveRefreshController } from './liveRefreshController.js'

export function useLiveRefresh(refresh, options = {}) {
  const refreshRef = useRef(refresh)
  const controllerRef = useRef(null)
  refreshRef.current = refresh

  const { enabled = true, pollIntervalMs = 15_000, refreshImmediately = true } = options

  useEffect(() => {
    if (!enabled) return undefined

    const controller = createLiveRefreshController({
      refresh: () => refreshRef.current(),
      pollIntervalMs,
    })
    controllerRef.current = controller
    controller.start({ refreshImmediately })

    return () => {
      controller.stop()
      if (controllerRef.current === controller) controllerRef.current = null
    }
  }, [enabled, pollIntervalMs, refreshImmediately])

  const refreshNow = useCallback(() => controllerRef.current?.refreshNow(), [])
  return { refreshNow }
}
