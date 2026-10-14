import { clientApi } from '../../adapters/clientApi.js'
import { tenantSession } from '../../adapters/tenantSession.js'

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message)
    this.status = status
    this.code = code
  }
}

function request(path, options) {
  return clientApi.request(path, options)
}

function getApiBase() {
  return (
    (typeof window !== 'undefined' && (window.FINSTACK_API_BASE_URL || window.FinStackApi?.baseUrl)) ||
    'http://localhost:3000'
  ).replace(/\/$/, '')
}

export const complianceApi = {
  /**
   * Fetches expenses currently awaiting compliance review for this organization.
   */
  async getComplianceQueue(signal) {
    return request('/api/v1/tenant/expenses/compliance/queue', { signal })
  },

  /**
   * Approves a flagged / escalated expense and forwards it to the Finance Officer.
   */
  async approveClaim(expenseId, note) {
    return request(`/api/v1/tenant/expenses/${expenseId}/compliance/approve`, {
      method: 'POST',
      body: { note: note?.trim() || undefined },
    })
  },

  /**
   * Rejects an expense during compliance review and notifies the submitter.
   */
  async rejectClaim(expenseId, note) {
    return request(`/api/v1/tenant/expenses/${expenseId}/compliance/reject`, {
      method: 'POST',
      body: { note: note?.trim() || undefined },
    })
  },

  /**
   * Initiates corrective action on an expense and records a compliance audit event.
   */
  async correctiveAction(expenseId, note) {
    return request(`/api/v1/tenant/expenses/${expenseId}/compliance/corrective-action`, {
      method: 'POST',
      body: { note: note?.trim() || undefined },
    })
  },

  /**
   * Lists active categories for the authenticated tenant.
   */
  async getCategories(signal) {
    return request('/api/v1/tenant/expenses/categories', { signal })
  },

  /**
   * Lists active policies for the authenticated tenant.
   */
  async getPolicies(signal) {
    return request('/api/v1/tenant/expenses/policies', { signal })
  },

  /**
   * Downloads receipt file as Blob. Scoped to authenticated tenant.
   */
  async downloadReceipt(expenseId) {
    const session = tenantSession.current()
    if (!session) throw new ApiError('Sign in again to continue.', 401)

    const url = `${getApiBase()}/api/v1/tenant/expenses/${expenseId}/receipt`
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
      },
    })

    if (!res.ok) {
      if (res.status === 401) tenantSession.logout()
      const err = await res.json().catch(() => null)
      const message = err?.error?.message || err?.message
      throw new ApiError(
        res.status === 404
          ? 'Receipt not found.'
          : res.status === 403
            ? 'Access denied to this receipt.'
            : message || 'Failed to download receipt.',
        res.status,
        err?.error?.code,
      )
    }

    const blob = await res.blob()
    const contentType = res.headers.get('content-type') || 'application/octet-stream'
    return { blob, contentType }
  },

  /**
   * Fetches paginated organization audit logs.
   */
  async getAuditLogs(
    { page = 1, pageSize = 25, search, eventCode, targetType, outcome, from, to } = {},
    signal,
  ) {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    })
    if (search) params.set('search', search)
    if (eventCode) params.set('eventCode', eventCode)
    if (targetType) params.set('targetType', targetType)
    if (outcome) params.set('outcome', outcome)
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    return request(`/api/v1/tenant/configuration/audit-logs?${params.toString()}`, { signal })
  },

  /**
   * Downloads CSV export of organization audit logs.
   */
  async exportAuditLogs({ search, eventCode, targetType, outcome, from, to } = {}) {
    const session = tenantSession.current()
    if (!session) throw new ApiError('Sign in again to continue.', 401)

    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (eventCode) params.set('eventCode', eventCode)
    if (targetType) params.set('targetType', targetType)
    if (outcome) params.set('outcome', outcome)
    if (from) params.set('from', from)
    if (to) params.set('to', to)

    const query = params.toString() ? `?${params.toString()}` : ''
    const url = `${getApiBase()}/api/v1/tenant/configuration/audit-logs/export${query}`
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
      },
    })

    if (!res.ok) {
      if (res.status === 401) tenantSession.logout()
      throw new ApiError('Failed to export audit logs.', res.status)
    }

    return res.blob()
  },

  /**
   * Fetches paginated notifications for the authenticated compliance officer.
   */
  async getNotifications({ page = 1, pageSize = 50, state, type } = {}, signal) {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    })
    if (state && state !== 'all') params.set('state', state)
    if (type) params.set('type', type)
    return request(`/api/v1/tenant/expenses/notifications/page?${params.toString()}`, { signal })
  },

  /**
   * Fetches unread notification count.
   */
  async getUnreadNotificationCount(signal) {
    return request('/api/v1/tenant/expenses/notifications/unread-count', { signal })
  },

  /**
   * Marks a notification as read.
   */
  async markNotificationRead(id) {
    return request(`/api/v1/tenant/expenses/notifications/${id}/read`, {
      method: 'PATCH',
    })
  },

  /**
   * Marks all notifications as read.
   */
  async markAllNotificationsRead() {
    return request('/api/v1/tenant/expenses/notifications/read-all', {
      method: 'POST',
    })
  },
}
