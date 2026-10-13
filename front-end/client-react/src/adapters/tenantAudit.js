import { clientApi } from './clientApi.js'
import { tenantSession } from './tenantSession.js'
import { downloadCsv } from './employeeImports.js'
const PATH = '/api/v1/tenant/configuration/audit-logs'
export function auditQuery(params) {
  return new URLSearchParams(Object.entries(params).filter(([,value]) => value !== '' && value != null)).toString()
}
export const tenantAudit = {
  list: params => clientApi.request(`${PATH}?${auditQuery(params)}`),
  detail: id => clientApi.request(`${PATH}/${encodeURIComponent(id)}`),
  async export(params) {
    const session = tenantSession.current()
    if (!session) throw new Error('Sign in again to continue.')
    const response = await fetch(`${clientApi.baseUrl()}${PATH}/export?${auditQuery(params)}`, {headers:{Authorization:`Bearer ${session.accessToken}`},cache:'no-store'})
    if(response.status === 401) { window.FinStackTenantSession?.handleUnauthorized(); throw new Error('Your session expired. Sign in again.') }
    if(!response.ok) { const body=await response.json().catch(()=>null); throw new Error(body?.message || 'Audit export failed.') }
    downloadCsv(await response.blob(), `finstack-audit-logs-${new Date().toISOString().slice(0,10)}.csv`)
  },
}
