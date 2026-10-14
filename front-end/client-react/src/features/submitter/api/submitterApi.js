import {
  ApiError,
  apiBase,
  clearSession,
  currentSession,
  request,
} from '../../../services/session'
import { fetchExpenseReceipt } from './receiptApi'

const EXPENSES_BASE = '/api/v1/tenant/expenses'

const asArray = (value) => Array.isArray(value) ? value : value?.items || []

export function normalizeExpense(item) {
  return {
    ...item,
    amount: String(item?.amount ?? '0'),
    category: item?.category?.name || item?.categoryName || item?.category || item?.categoryId || 'Uncategorized',
    status: item?.status || item?.workflowStatus || 'submitted',
    history: Array.isArray(item?.history) ? item.history : [],
  }
}

function requiredText(value, fieldName) {
  const text = String(value ?? '').trim()

  if (!text) {
    throw new Error(`${fieldName} is required.`)
  }

  return text
}

export async function getExpenseReceipt(id) {
  if (!id) throw new Error('Expense ID is required.')

  const session = currentSession()
  if (!session) {
    clearSession()
    throw new ApiError('Sign in again to view this receipt.', 401)
  }

  return fetchExpenseReceipt({
    id,
    baseUrl: apiBase(),
    accessToken: session.accessToken,
    onUnauthorized: clearSession,
  })
}

export const submitterApi = {
  async createExpense(data, receipt = null) {
    const form = new FormData()

    form.append(
      'amount',
      requiredText(data.amount, 'Amount'),
    )

    form.append(
      'categoryId',
      requiredText(data.categoryId, 'Category'),
    )

    form.append(
      'merchant',
      requiredText(data.merchant, 'Merchant'),
    )

    form.append(
      'date',
      requiredText(data.date, 'Date'),
    )

    if (data.currency) {
      form.append(
        'currency',
        String(data.currency).trim(),
      )
    }

    if (data.notes?.trim()) {
      form.append(
        'notes',
        data.notes.trim(),
      )
    }

    if (data.paymentMethod?.trim()) {
      form.append(
        'paymentMethod',
        data.paymentMethod.trim(),
      )
    }

    if (receipt) {
      form.append(
        'receipt',
        receipt,
        receipt.name,
      )
    }

    return request(EXPENSES_BASE, {
      method: 'POST',
      body: form,
    })
  },

  async getMyExpenses() {
    return asArray(await request(`${EXPENSES_BASE}/mine`)).map(normalizeExpense)
  },

  async getCategories() {
    return asArray(await request(`${EXPENSES_BASE}/categories`))
  },

  getReceipt(id) {
    return getExpenseReceipt(id)
  },

  async updateExpense(id, updates) {
    if (!id) {
      throw new Error('Expense ID is required.')
    }

    return request(
      `${EXPENSES_BASE}/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body: updates,
      },
    )
  },

  async deleteExpense(id) {
    if (!id) {
      throw new Error('Expense ID is required.')
    }

    return request(
      `${EXPENSES_BASE}/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
      },
    )
  },

  async getNotifications() {
    const result = await request(`${EXPENSES_BASE}/notifications/page?page=1&pageSize=50&state=all`)
    return { ...result, items: asArray(result).map((item) => ({ ...item, unread: item.unread ?? item.readAt == null })) }
  },

  markNotificationRead(id) {
    return request(`${EXPENSES_BASE}/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH' })
  },

  markNotificationUnread(id) {
    return request(`${EXPENSES_BASE}/notifications/${encodeURIComponent(id)}/unread`, { method: 'PATCH' })
  },

  markAllNotificationsRead() {
    return request(`${EXPENSES_BASE}/notifications/read-all`, { method: 'POST' })
  },

  deleteNotification(id) {
    return request(`${EXPENSES_BASE}/notifications/${encodeURIComponent(id)}`, { method: 'DELETE' })
  },
}
