import { tenantSession } from './tenantSession.js'

// Delegates to auth.js so headers, response unwrapping, session expiry, and storage
// compatibility remain owned by the existing client runtime.
export const clientApi = {
  baseUrl() {
    return window.FinStackApi?.baseUrl || null
  },
  supports(capability) {
    return ['tenantSubscription', 'users', 'categories', 'policies', 'roles'].includes(capability)
  },
  request(path, options) {
    return tenantSession.request(path, options)
  },
}

function legacyStoreRuntime() {
  return window.FinStackStore || null
}

export const legacyStore = {
  async ready() {
    const store = legacyStoreRuntime()
    if (!store) throw new Error('FinStackStore is unavailable.')
    await store.ready
    return store
  },
  async read(reader) {
    const store = await legacyStore.ready()
    return reader(store)
  },
}
