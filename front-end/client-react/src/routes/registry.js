import { configManagerRoutes } from '../features/config-manager/routes'

// Actor route modules join this list as their existing HTML pages are migrated.
const STATIC_ROUTES = [...configManagerRoutes]

function normalizedPath(pathname) {
  return String(pathname || '/').replace(/\\/g, '/').toLowerCase()
}

export function getRouteForPath(pathname) {
  const path = normalizedPath(pathname)
  return STATIC_ROUTES.find((route) => path.endsWith(route.path)) || null
}

export { STATIC_ROUTES }
