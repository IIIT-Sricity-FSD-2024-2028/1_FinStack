// Credentials and controllers belong to a request lifetime, never Redux state.
// Both thunk features retain their own generation/request-id protections.
export function createSessionGuard({ getSession, getFeatureSession, identityOf }) {
  let bound = null
  const controllers = new Set()
  const guard = {
    bind() {
      const current = getSession()
      const identity = identityOf(current?.user, current?.organizationId)
      bound = identity && current?.accessToken ? { identity, token: current.accessToken } : null
    },
    end() {
      bound = null
      for (const controller of controllers) controller.abort()
      controllers.clear()
    },
    isCurrent(generation) {
      const current = getSession()
      const feature = getFeatureSession()
      return Boolean(bound && feature.identity === bound.identity && feature.generation === generation &&
        current?.accessToken === bound.token && identityOf(current?.user, current?.organizationId) === bound.identity)
    },
    async run(generation, signal, operation) {
      const assertCurrent = () => {
        if (!guard.isCurrent(generation)) throw new Error('Your session changed. Sign in again to continue.')
      }
      assertCurrent()
      const controller = new AbortController()
      const abort = () => controller.abort()
      signal?.addEventListener('abort', abort, { once: true })
      if (signal?.aborted) abort()
      controllers.add(controller)
      try {
        const result = await operation(controller.signal)
        assertCurrent()
        if (controller.signal.aborted) throw new Error('The request was cancelled.')
        return result
      } finally {
        controllers.delete(controller)
        signal?.removeEventListener('abort', abort)
      }
    },
  }
  return guard
}
