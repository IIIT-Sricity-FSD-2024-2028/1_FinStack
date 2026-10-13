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

export const financeApi = {
  /**
   * Fetches expenses currently awaiting finance review assigned to this officer.
   */
  async getFinanceQueue(signal) {
    return request('/api/v1/tenant/expenses/finance/queue', { signal })
  },

  /**
   * Fetches the complete workspace for this finance officer, including:
   * - assigned expenses across all lifecycle states
   * - internal transaction records for released payments
   */
  async getFinanceWorkspace(signal) {
    return request('/api/v1/tenant/expenses/finance/workspace', { signal })
  },

  /**
   * Approves an expense in finance review for payment.
   */
  async approveExpense(expenseId, note) {
    return request(`/api/v1/tenant/expenses/${expenseId}/finance/approve`, {
      method: 'POST',
      body: { note: note?.trim() || undefined },
    })
  },

  /**
   * Rejects an expense during finance review.
   */
  async rejectExpense(expenseId, note) {
    return request(`/api/v1/tenant/expenses/${expenseId}/finance/reject`, {
      method: 'POST',
      body: { note: note?.trim() || undefined },
    })
  },

  /**
   * Requests additional information from the submitter.
   */
  async requestInfoExpense(expenseId, note) {
    return request(`/api/v1/tenant/expenses/${expenseId}/finance/request-info`, {
      method: 'POST',
      body: { note: note?.trim() || undefined },
    })
  },

  /**
   * Flags an expense for compliance review.
   */
  async flagExpense(expenseId, note) {
    return request(`/api/v1/tenant/expenses/${expenseId}/finance/flag`, {
      method: 'POST',
      body: { note: note?.trim() || undefined },
    })
  },

  /**
   * Releases a batch of approved expenses for payment processing.
   * Note: Creates internal transaction records; does NOT perform a live bank wire.
   */
  async releasePayment(expenseIds) {
    if (!Array.isArray(expenseIds) || expenseIds.length === 0) {
      throw new ApiError('Select at least one expense to release.', 400)
    }
    return request('/api/v1/tenant/expenses/finance/payment-releases', {
      method: 'POST',
      body: { expenseIds },
    })
  },

  /**
   * Transitions a pending transaction to processed.
   */
  async processTransaction(transactionId) {
    return request(`/api/v1/tenant/expenses/finance/transactions/${transactionId}/process`, {
      method: 'POST',
    })
  },

  /**
   * Transitions a pending transaction to failed.
   */
  async failTransaction(transactionId) {
    return request(`/api/v1/tenant/expenses/finance/transactions/${transactionId}/fail`, {
      method: 'POST',
    })
  },

  /**
   * Reconciles a processed transaction, marking the expense paid.
   */
  async reconcileTransaction(transactionId) {
    return request(`/api/v1/tenant/expenses/finance/transactions/${transactionId}/reconcile`, {
      method: 'POST',
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
      const err = await res.json().catch(() => null)
      const message = err?.error?.message || err?.message
      throw new ApiError(
        res.status === 404
          ? 'Receipt not found.'
          : res.status === 403
            ? 'Access denied to this receipt.'
            : message || 'Failed to download receipt.',
        res.status,
      )
    }

    const blob = await res.blob()
    const contentType = res.headers.get('content-type') || 'application/octet-stream'
    return { blob, contentType }
  },

  /**
   * Fetches paginated notifications for the authenticated finance officer.
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
