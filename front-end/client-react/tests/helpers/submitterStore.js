import { createClientStore } from '../../src/app/store.js'

const sessions = new WeakMap()
export function createSubmitterStore(api) {
  let current = null
  const store = createClientStore({ submitterApi: api, getSession: () => current })
  let sequence = 0
  sessions.set(store, identity => {
    const [organizationId, id] = identity ? JSON.parse(identity) : []
    current = identity ? { accessToken: `fictional-submitter-${++sequence}`, organizationId,
      user: { id, organizationId, role: 'EXPENSE_SUBMITTER', status: 'ACTIVE' } } : null
    store.startSession()
  })
  return store
}
export function bindSubmitterSession(store, identity) { sessions.get(store)(identity) }
