import { useCallback, useEffect, useRef, useState } from 'react'
import { createLiveRefreshController } from './liveRefreshController.js'

export function useLiveRefresh(refresh, options = {}) {
  const refreshRef = useRef(refresh)
  const controllerRef = useRef(null)
  const [refreshError, setRefreshError] = useState(null)
  refreshRef.current = refresh

  const { enabled = true, pollIntervalMs = 15_000, refreshImmediately = true } = options

  useEffect(() => {
    if (!enabled) return undefined

    const controller = createLiveRefreshController({
      refresh: async (context) => {
        try {
          const result = await refreshRef.current(context)
          if (context.background) setRefreshError(null)
          return result
        } catch (error) {
          if (context.background) setRefreshError(error)
          throw error
        }
      },
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
  const retryNow = useCallback(() => controllerRef.current?.retryNow(), [])
  return { refreshNow, retryNow, refreshError }
}
