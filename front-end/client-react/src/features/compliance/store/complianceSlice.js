import { createAsyncThunk, createSelector, createSlice } from '@reduxjs/toolkit'
import { activePolicies } from '../../shared/expensePresentation.js'

const resource = (data) => ({ data, loaded: false, requestId: null, query: null, key: '', error: '' })
const pageData = () => ({ items: [], total: 0, totalPages: 1 })
const initialState = () => ({
  session: { identity: null, generation: 0 },
  queue: resource([]),
  policies: resource([]),
  categories: resource([]),
  audit: resource(pageData()),
  notifications: resource(pageData()),
  unread: resource(0),
  deciding: false,
  markingRead: false,
})

export const queryKey = (query = {}) => JSON.stringify(
  Object.entries(query).filter(([, value]) => value !== undefined && value !== '')
    .sort(([a], [b]) => a.localeCompare(b)),
)

const decisionResources = ['queue', 'audit', 'notifications', 'unread']
const notificationResources = ['notifications', 'unread']
function invalidate(state, names) {
  for (const name of names) {
    // Revoke ownership before starting a write. Even an unabortable earlier GET
    // cannot restore a pre-mutation snapshot, including when the write fails.
    state[name].requestId = null
  }
}

const readMethods = {
  queue: 'getComplianceQueue', policies: 'getPolicies', categories: 'getCategories',
  audit: 'getAuditLogs', notifications: 'getNotifications', unread: 'getUnreadNotificationCount',
}

function normalize(name, data) {
  if (['queue', 'policies', 'categories'].includes(name)) return Array.isArray(data) ? data : []
  if (name === 'unread') return typeof data === 'number' ? data : data?.unreadCount ?? data?.count ?? 0
  if (Array.isArray(data)) return { items: data, total: data.length, totalPages: 1 }
  return { items: Array.isArray(data?.items) ? data.items : [], total: data?.total || 0,
    totalPages: data?.totalPages || 1, ...(name === 'notifications' && data?.unreadCount !== undefined
      ? { unreadCount: data.unreadCount } : {}) }
}

export const fetchComplianceResource = createAsyncThunk(
  'compliance/fetchResource',
  async ({ resource: name, query = {} }, { extra, getState, signal, rejectWithValue }) => {
    const generation = getState().compliance.session.generation
    try {
      const result = await extra.session.run(generation, signal, (requestSignal) =>
        ['audit', 'notifications'].includes(name)
          ? extra.api[readMethods[name]](query, requestSignal)
          : extra.api[readMethods[name]](requestSignal))
      return normalize(name, result)
    } catch (error) {
      return rejectWithValue(error?.message || 'Unable to load compliance data. Please retry.')
    }
  },
  { condition: ({ resource: name, query = {}, force = false }, { getState, extra }) => {
    const state = getState().compliance
    if (!extra.session.isCurrent(state.session.generation) || !readMethods[name]) return false
    if ((state.deciding && decisionResources.includes(name)) ||
        (state.markingRead && notificationResources.includes(name))) return false
    if (name === 'unread' && state.notifications.requestId) return false
    const entry = state[name]
    if (entry.requestId && entry.key === queryKey(query)) return false
    return force || !entry.loaded || Boolean(entry.error) || entry.key !== queryKey(query)
  } },
)

const submitDecision = createAsyncThunk(
  'compliance/decision',
  async ({ expenseId, type, note = '' }, { extra, getState, signal, rejectWithValue }) => {
    const generation = getState().compliance.session.generation
    try {
      const method = { approve: 'approveClaim', reject: 'rejectClaim', correctiveAction: 'correctiveAction' }[type]
      if (!method || !expenseId) throw new Error('Select a supported compliance decision.')
      if (type !== 'approve' && !note.trim()) throw new Error('A decision note is required.')
      return await extra.session.run(generation, signal,
        (requestSignal) => extra.api[method](expenseId, note.trim(), requestSignal))
    } catch (error) {
      return rejectWithValue(error?.message || 'Failed to submit decision. Please retry.')
    }
  },
  { condition: (_, { getState, extra }) => {
    const state = getState().compliance
    return extra.session.isCurrent(state.session.generation) && !state.deciding
  } },
)

const submitRead = createAsyncThunk(
  'compliance/markRead',
  async ({ id }, { extra, getState, signal, rejectWithValue }) => {
    const generation = getState().compliance.session.generation
    try {
      return await extra.session.run(generation, signal, (requestSignal) => id
        ? extra.api.markNotificationRead(id, requestSignal)
        : extra.api.markAllNotificationsRead(requestSignal))
    } catch (error) {
      return rejectWithValue(error?.message || 'Failed to mark notifications read. Please retry.')
    }
  },
  { condition: (_, { getState, extra }) => {
    const state = getState().compliance
    return extra.session.isCurrent(state.session.generation) && !state.markingRead
  } },
)

const slice = createSlice({
  name: 'compliance', initialState: initialState(),
  reducers: {
    sessionChanged(state, action) {
      return { ...initialState(), session: { identity: action.payload, generation: state.session.generation + 1 } }
    },
    pageQueryChanged(state, action) {
      const { name, query } = action.payload
      const key = queryKey(query)
      if (state[name].key !== key) state[name] = { ...resource(pageData()), query, key }
    },
  },
  extraReducers: (builder) => {
    builder.addCase(fetchComplianceResource.pending, (state, action) => {
      const { resource: name, query = {} } = action.meta.arg
      const entry = state[name]
      const key = queryKey(query)
      if (entry.key !== key) Object.assign(entry, resource(['audit', 'notifications'].includes(name) ? pageData() : entry.data))
      Object.assign(entry, { requestId: action.meta.requestId, query, key, error: '' })
      if (name === 'notifications') state.unread.requestId = null
    })
    builder.addCase(fetchComplianceResource.fulfilled, (state, action) => {
      const name = action.meta.arg.resource
      if (state[name].requestId !== action.meta.requestId) return
      const { unreadCount, ...page } = name === 'notifications' ? action.payload : {}
      Object.assign(state[name], { data: name === 'notifications' ? page : action.payload, loaded: true, requestId: null, error: '' })
      if (name === 'notifications' && unreadCount !== undefined) {
        Object.assign(state.unread, { data: unreadCount, loaded: true, requestId: null, error: '' })
      }
    })
    builder.addCase(fetchComplianceResource.rejected, (state, action) => {
      const entry = state[action.meta.arg.resource]
      if (!entry || entry.requestId !== action.meta.requestId) return
      entry.requestId = null
      entry.error = action.meta.aborted ? '' : action.payload || action.error.message
    })
    builder.addCase(submitDecision.pending, (state, action) => {
      state.deciding = action.meta.requestId
      invalidate(state, decisionResources)
    })
    builder.addCase(submitDecision.fulfilled, (state, action) => {
      if (state.deciding !== action.meta.requestId) return
      state.deciding = false
      invalidate(state, decisionResources)
      const result = action.payload
      // Apply only the server's returned workflow status; corrective action may
      // legitimately leave the expense in compliance_review.
      if (result?.id && result.workflowStatus) {
        state.queue.data = state.queue.data.flatMap((expense) => expense.id !== result.id
          ? [expense] : result.workflowStatus === 'compliance_review'
            ? [{ ...expense, ...result, employee: expense.employee, category: expense.category }]
            : [])
      }
    })
    builder.addCase(submitDecision.rejected, (state, action) => {
      if (state.deciding !== action.meta.requestId) return
      state.deciding = false
      invalidate(state, decisionResources)
    })
    builder.addCase(submitRead.pending, (state, action) => {
      state.markingRead = action.meta.requestId
      invalidate(state, notificationResources)
    })
    for (const actionCreator of [submitRead.fulfilled, submitRead.rejected]) {
      builder.addCase(actionCreator, (state, action) => {
        if (state.markingRead !== action.meta.requestId) return
        state.markingRead = false
        invalidate(state, notificationResources)
      })
    }
  },
})

export const { sessionChanged, pageQueryChanged } = slice.actions
export default slice.reducer

export const refreshResources = (names) => (dispatch, getState) => Promise.all(names.map((name) => {
  const query = getState().compliance[name].query
  if (['audit', 'notifications'].includes(name) && !query) return undefined
  return dispatch(fetchComplianceResource({ resource: name, query: query || {}, force: true }))
}))

// Layout owns the only queue/badge loop. The page response carries the backend
// unread aggregate, so it replaces the separate badge GET while that page is active.
export const refreshWorkspace = (notificationsVisible) => (dispatch, getState) => {
  const hasQuery = notificationsVisible && getState().compliance.notifications.query
  return dispatch(refreshResources(['queue', hasQuery ? 'notifications' : 'unread']))
}

async function mutateAndRefresh(dispatch, getState, extra, thunk, names) {
  const generation = getState().compliance.session.generation
  const action = await dispatch(thunk)
  if (!action.meta.condition && extra.session.isCurrent(generation)) {
    await dispatch(refreshResources(names))
  }
  if (action.meta.requestStatus === 'rejected') throw new Error(
    action.meta.condition ? 'An action is already in progress or your session changed.'
      : action.payload || action.error.message,
  )
  return action.payload
}

export const decideExpense = (args) => (dispatch, getState, extra) =>
  mutateAndRefresh(dispatch, getState, extra, submitDecision(args), decisionResources)
export const markNotificationsRead = (args = {}) => (dispatch, getState, extra) =>
  mutateAndRefresh(dispatch, getState, extra, submitRead(args), notificationResources)

export const selectQueue = (state) => state.compliance.queue.data
export const selectCategories = (state) => state.compliance.categories.data
export const selectActivePolicies = createSelector([(state) => state.compliance.policies.data], activePolicies)
export const selectUnreadCount = (state) => state.compliance.unread.data

export function resourceStatus(entries) {
  return {
    loading: entries.some((entry) => !entry.loaded && !entry.error),
    error: entries.filter((entry) => !entry.loaded).map((entry) => entry.error).filter(Boolean).join(' '),
    refreshError: entries.some((entry) => entry.loaded && entry.error),
  }
}
