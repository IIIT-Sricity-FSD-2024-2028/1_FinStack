import { createApi } from '@reduxjs/toolkit/query/react'
import { tenantSession } from '../adapters/tenantSession.js'
import { selectSessionScope } from './sessionSlice.js'

export const tenantTagTypes = ['Employees', 'Roles', 'Hierarchy', 'Categories', 'Policies',
  'Templates', 'Audit', 'Notifications', 'Subscription', 'Imports', 'Organization', 'Profile', 'Preferences',
  'FinanceWorkspace', 'FinanceQueue', 'FinanceNotifications', 'FinanceCategories', 'FinancePolicies',
  'ManagerQueue', 'ManagerHistory', 'ManagerOfficers']

export const tenantApi = createApi({
  reducerPath: 'tenantApi',
  baseQuery: tenantBaseQuery,
  tagTypes: tenantTagTypes,
  endpoints: () => ({}),
  refetchOnMountOrArgChange: true,
})

export function serializableError(error) {
  return { message: error?.message || 'The request could not be completed.',
    ...(typeof error?.status === 'number' ? { status: error.status } : {}),
    ...(typeof error?.code === 'string' ? { code: error.code } : {}) }
}

function sameSession(expected, current) {
  return Boolean(expected?.accessToken && current?.accessToken === expected.accessToken &&
    current?.organizationId === expected.organizationId && current?.user?.id === expected.user?.id &&
    current?.user?.role === expected.user?.role && current?.user?.status === expected.user?.status)
}

// Keep all existing HTTP/payload adapters. Late responses from an old session
// are rejected even when an adapter does not expose AbortSignal support.
export const adapterQuery = operation => async ({ scope, args }, api) => {
  const getSession = api.extra?.getSession || (() => tenantSession.current())
  const session = getSession()
  const valid = () => !api.signal.aborted && scope === selectSessionScope(api.getState()) &&
    sameSession(session, getSession())
  if (!valid()) return { error: { message: 'Sign in again to continue.', status: 401 } }
  try {
    const data = await operation(args, api.signal)
    if (!valid()) return { error: { message: 'The session changed. Retry after signing in.', status: 401 } }
    return { data: data === undefined ? null : data }
  } catch (error) {
    return { error: serializableError(error) }
  }
}

// Actor transports keep their original method/payload contracts. Credentials
// are read privately for the lifetime check and never become Redux arguments.
export async function tenantBaseQuery(descriptor, api) {
  const scope = selectSessionScope(api.getState())
  const session = api.extra.getSession()
  const current = () => {
    const latest = api.extra.getSession()
    return !api.signal.aborted && scope === selectSessionScope(api.getState()) &&
      sameSession(session, latest)
  }
  const failure = error => {
    const plain = serializableError(error)
    return { error: { ...plain, status: plain.status || 'FETCH_ERROR', data: { ...plain } } }
  }
  if (!current()) return failure({ message: 'Sign in again to continue.', status: 401 })
  try {
    let data
    if (descriptor.channel === 'finance') {
      data = await api.extra.financeApi[descriptor.operation](...(descriptor.args || []), api.signal)
    } else if (descriptor.url) {
      const { url, ...options } = descriptor
      data = await api.extra.request(url, { ...options, signal: api.signal,
        ...(api.type === 'mutation' ? { suppressLocalRefresh: true } : {}) })
    } else throw new Error('Unsupported tenant API operation.')
    if (!current()) return failure({ message: 'The session changed. Retry after signing in.', status: 401 })
    return { data: data === undefined ? null : data }
  } catch (error) { return failure(error) }
}
