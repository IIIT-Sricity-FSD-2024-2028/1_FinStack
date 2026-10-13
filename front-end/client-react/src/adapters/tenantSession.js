function tenantRuntime() {
  return window.FinStackTenantSession || null
}

export const tenantSession = {
  isAuthenticated() {
    const runtime = tenantRuntime()
    return Boolean(runtime && runtime.isTenantAuthenticated())
  },
  current() {
    const runtime = tenantRuntime()
    return runtime ? runtime.getTenantSession() : null
  },
  user() {
    return tenantSession.current()?.user || null
  },
  organizationId() {
    return tenantSession.current()?.organizationId || null
  },
  logout() {
    // Existing pages retain ownership of their login URL and navigation.
    const runtime = tenantRuntime()
    if (runtime?.clearTenantSession) runtime.clearTenantSession()
    else window.FinStackGuard?.clearSession()
  },
  request(path, options) {
    const runtime = tenantRuntime()
    if (!runtime) return Promise.reject(new Error('Tenant session runtime is unavailable.'))
    return runtime.request(path, options)
  },
}
