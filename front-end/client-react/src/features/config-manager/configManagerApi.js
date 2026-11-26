import { tenantApi, adapterQuery } from '../../app/api.js'
import { configManagerResources as resources } from '../../adapters/configManagerResources.js'
import { employeeImports } from '../../adapters/employeeImports.js'
import { tenantAudit } from '../../adapters/tenantAudit.js'
import { clientApi } from '../../adapters/clientApi.js'

const settings = '/api/v1/tenant/configuration/settings'
const notifications = '/api/v1/tenant/expenses/notifications'
const request = (path, options) => clientApi.request(path, options)
const write = (path, method, body) => request(path, { method, ...(body === undefined ? {} : { body }) })
const employeeTags = ['Employees', 'Roles', 'Hierarchy', 'Audit', 'Subscription', 'Notifications']

export const configManagerApi = tenantApi.injectEndpoints({
  endpoints: build => {
    const query = (operation, tags) => build.query({ queryFn: adapterQuery(operation), providesTags: tags })
    const mutation = (operation, tags = []) => build.mutation({
      queryFn: adapterQuery(operation),
      invalidatesTags: (_result, error) => error ? [] : tags,
    })
    return {
      employees: query(args => resources.users.page(args), ['Employees']),
      managers: query(args => resources.users.managers(args), ['Employees']),
      roles: query(() => resources.roles.list(), ['Roles']),
      hierarchy: query(args => resources.hierarchy.summary(args), ['Hierarchy']),
      branch: query(args => resources.hierarchy.branch(args), ['Hierarchy']),
      employee: query(args => resources.hierarchy.employee(args), ['Hierarchy', 'Employees']),
      createEmployee: mutation(args => resources.users.create(args), employeeTags),
      updateEmployee: mutation(args => resources.users.update(...args), employeeTags),
      employeeStatus: mutation(args => resources.users.updateStatus(...args), employeeTags),
      updateManager: mutation(args => resources.hierarchy.updateManager(...args), employeeTags),
      categories: query(() => resources.categories.list(), ['Categories']),
      policies: query(() => resources.policies.list(), ['Policies']),
      templates: query(() => resources.templates.list(), ['Templates']),
      createCategory: mutation(args => resources.categories.create(args), ['Categories', 'Policies', 'Templates', 'Audit']),
      updateCategory: mutation(args => resources.categories.update(...args), ['Categories', 'Policies', 'Templates', 'Audit']),
      deleteCategory: mutation(args => resources.categories.delete(args), ['Categories', 'Policies', 'Templates', 'Audit']),
      createPolicy: mutation(args => resources.policies.create(args), ['Policies', 'Audit']),
      updatePolicy: mutation(args => resources.policies.update(...args), ['Policies', 'Audit']),
      deletePolicy: mutation(args => resources.policies.delete(args), ['Policies', 'Audit']),
      activateCategories: mutation(args => resources.templates.activateCategories(args), ['Categories', 'Policies', 'Templates', 'Audit']),
      activatePolicies: mutation(args => resources.templates.activatePolicies(args), ['Categories', 'Policies', 'Templates', 'Audit']),
      audit: query(args => tenantAudit.list(args), ['Audit']),
      auditDetail: query(id => tenantAudit.detail(id), ['Audit']),
      alerts: query(async () => {
        const pages = await Promise.all(['danger', 'warning'].map(type =>
          request(`${notifications}/page?page=1&pageSize=5&type=${type}`)))
        return pages.flatMap(page => page.items)
          .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 5)
      }, ['Notifications']),
      subscription: query(() => request('/api/v1/tenant/subscription'), ['Subscription']),
      notifications: query(args => request(`${notifications}/page?${new URLSearchParams(args)}`), ['Notifications']),
      updateNotifications: mutation(({ path, method }) => write(notifications + path, method), ['Notifications']),
      imports: query(() => employeeImports.list(), ['Imports']),
      importJob: query(id => employeeImports.get(id), ['Imports']),
      importRows: query(({ id, page }) => employeeImports.rows(id, page), ['Imports']),
      uploadImport: mutation(({ file, key }) => employeeImports.upload(file, key), ['Imports', 'Audit']),
      confirmImport: mutation(id => employeeImports.confirm(id), ['Imports', ...employeeTags]),
      activationLinks: mutation(id => employeeImports.activationLinks(id), ['Audit']),
      organization: query(() => request(`${settings}/organization`), ['Organization']),
      profile: query(() => request(`${settings}/profile`), ['Profile']),
      preferences: query(() => request(`${settings}/preferences`), ['Preferences']),
      updateOrganization: mutation(body => write(`${settings}/organization`, 'PATCH', body), ['Organization', 'Subscription', 'Audit']),
      updateProfile: mutation(body => write(`${settings}/profile`, 'PATCH', body), ['Profile', 'Employees', 'Hierarchy', 'Audit']),
      updatePreferences: mutation(body => write(`${settings}/preferences`, 'PATCH', body), ['Preferences', 'Audit']),
      revokeSessions: mutation(() => write(`${settings}/session-revocations`, 'POST'), ['Audit']),
      changePassword: mutation(body => write(`${settings}/password-changes`, 'POST', body), ['Audit']),
    }
  },
})
