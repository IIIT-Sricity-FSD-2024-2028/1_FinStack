import { clientApi } from './clientApi.js'

const CATEGORY_PATH = '/api/v1/tenant/expenses/configuration/categories'
const POLICY_PATH = '/api/v1/tenant/expenses/configuration/policies'
const CONFIGURATION_PATH = '/api/v1/tenant/configuration'

function request(path, options) {
  return clientApi.request(path, options)
}

function body(method, value) {
  return { method, body: value }
}

function categoryPayload(value, existing = {}) {
  return {
    name: value.name,
    description: value.description ?? existing.description ?? '',
    limit: Number(value.limit ?? existing.limit ?? 0),
    currency: value.currency || existing.currency || 'INR',
    status: value.status || existing.status || 'Active',
    requiresReceipt: value.requiresReceipt ?? existing.requiresReceipt ?? true,
    color: value.color || existing.color || '#7C3AED',
  }
}

function policyPayload(value, existing = {}) {
  return {
    name: value.name,
    categoryId: value.categoryId || existing.categoryId,
    ...(value.maxAmount !== undefined ? { maxAmount: String(value.maxAmount) } : {}),
    currency: value.currency || existing.currency || 'INR',
    approval: value.approval || existing.approval || 'Manager + Finance',
    status: value.status || existing.status || 'Active',
    description: value.description ?? existing.description ?? '',
    requiresApproval: value.requiresApproval ?? existing.requiresApproval ?? true,
    receiptRequired: value.receiptRequired ?? existing.receiptRequired ?? true,
  }
}

function normalizeUser(user) {
  const role = String(user.role || '').toLowerCase()
  return {
    ...user,
    roles: role ? [role] : [],
    status: user.status === 'ACTIVE' ? 'Active' : 'Inactive',
    managerEmployeeId: user.manager?.employeeId || '',
  }
}

function normalizeRole(role) {
  const id = String(role.key || '').toLowerCase()
  return {
    id,
    name: role.name,
    description: role.description,
    permissions: role.capabilities || [],
    userCount: role.userCount || 0,
    enabled: true,
    required: id === 'configuration_manager',
  }
}

export const configManagerResources = {
  hierarchy: {
    summary(params = {}) { return request(`${CONFIGURATION_PATH}/hierarchy?${new URLSearchParams(params)}`) },
    branch(params = {}) { return request(`${CONFIGURATION_PATH}/hierarchy/branches?${new URLSearchParams(params)}`) },
    employee({id}) { return request(`${CONFIGURATION_PATH}/hierarchy/employees/${encodeURIComponent(id)}`) },
    updateManager(id, managerId, expectedManagerId) {
      return request(`${CONFIGURATION_PATH}/users/${encodeURIComponent(id)}/reporting`, body('PATCH', {managerId,expectedManagerId}))
    },
  },
  templates: {
    list: () => request('/api/v1/tenant/expenses/configuration/templates'),
    activateCategories: (value) => request(`${CATEGORY_PATH}/activate-templates`, body('POST', value)),
    activatePolicies: (value) => request(`${POLICY_PATH}/activate-templates`, body('POST', value)),
  },
  categories: {
    list: () => request(CATEGORY_PATH),
    create: (value) => request(CATEGORY_PATH, body('POST', categoryPayload(value))),
    update: (id, value, existing) => request(`${CATEGORY_PATH}/${encodeURIComponent(id)}`, body('PATCH', categoryPayload(value, existing))),
    delete: (id) => request(`${CATEGORY_PATH}/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  },
  policies: {
    list: () => request(POLICY_PATH),
    create: (value) => request(POLICY_PATH, body('POST', policyPayload(value))),
    update: (id, value, existing) => request(`${POLICY_PATH}/${encodeURIComponent(id)}`, body('PATCH', policyPayload(value, existing))),
    delete: (id) => request(`${POLICY_PATH}/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  },
  users: {
    async page(params = {}) {
      const query = new URLSearchParams()
      for (const [key,value] of Object.entries(params)) if(value !== '' && value !== undefined) query.set(key,String(value))
      const response = await request(`${CONFIGURATION_PATH}/employees?${query}`)
      return {...response,items:response.items.map(normalizeUser)}
    },
    managers(params = {}) {
      return configManagerResources.users.page({...params,pageSize:20,role:'MANAGER',status:'ACTIVE'})
    },
    async list() {
      const response = await request(`${CONFIGURATION_PATH}/users`)
      return (response?.items || []).map(normalizeUser)
    },
    create(value) {
      return request(`${CONFIGURATION_PATH}/users`, body('POST', {
        employeeId: value.employeeId,
        firstName: value.firstName,
        lastName: value.lastName,
        email: value.email,
        initialPassword: value.password,
        role: String(value.role || '').toUpperCase(),
        department: value.department || 'General',
        ...(value.managerId ? { managerId: value.managerId } : {}),
      }))
    },
    update(id, value) {
      return request(`${CONFIGURATION_PATH}/users/${encodeURIComponent(id)}`, body('PATCH', {...value,role:String(value.role).toUpperCase()}))
    },
    updateStatus(id, status) {
      return request(`${CONFIGURATION_PATH}/users/${encodeURIComponent(id)}/status`, body('PATCH', { status: String(status).toUpperCase() }))
    },
  },
  roles: {
    async list() {
      const response = await request(`${CONFIGURATION_PATH}/roles`)
      return (response?.items || []).map(normalizeRole)
    },
  },
}

export async function mutateAndRefresh(operation, refresh) {
  const result = await operation()
  await refresh()
  return result
}

export const configManagerResourceInternals = { categoryPayload, policyPayload, normalizeUser, normalizeRole }
