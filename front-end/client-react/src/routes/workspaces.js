import { legacyPaths } from './paths.ts'

export const submitterPages = ['dashboard', 'submit', 'expenses', 'status', 'reports', 'notifications', 'profile-settings']

export const roleDashboards = {
  CONFIGURATION_MANAGER: '/configuration/dashboard',
  EXPENSE_SUBMITTER: '/dashboard',
  MANAGER: '/manager/dashboard',
  FINANCE_OFFICER: '/finance/dashboard',
  COMPLIANCE_OFFICER: '/compliance/dashboard',
}

export function roleOwnsPath(role, pathname) {
  if (role === 'EXPENSE_SUBMITTER') return submitterPages.some(page => pathname === `/${page}` || pathname === `/${page}/`)
  const prefix = {
    CONFIGURATION_MANAGER: '/configuration',
    MANAGER: '/manager',
    FINANCE_OFFICER: '/finance',
    COMPLIANCE_OFFICER: '/compliance',
  }[role]
  return Boolean(prefix && (pathname === prefix || pathname.startsWith(prefix + '/')))
}

export function loginDestination(role, from, configurationDefault = 'dashboard') {
  const dashboard = roleDashboards[role]
  if (!dashboard) return '/forbidden'
  if (typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') && !from.includes('\\') && !Array.from(from).some(char => char.charCodeAt(0) <= 32)) {
    const url = new URL(from, 'https://finstack.invalid')
    const pathname = legacyPaths[url.pathname] || url.pathname
    if (roleOwnsPath(role, pathname)) return pathname + url.search + url.hash
  }
  if (role === 'CONFIGURATION_MANAGER' && ['dashboard', 'notifications', 'audit-logs'].includes(configurationDefault)) {
    return '/configuration/' + configurationDefault
  }
  return dashboard
}
