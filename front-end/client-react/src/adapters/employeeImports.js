import { clientApi } from './clientApi.js'
import { tenantSession } from './tenantSession.js'
const PATH = '/api/v1/tenant/configuration/employee-imports'
async function binaryRequest(path, options = {}) {
  const session = tenantSession.current()
  if (!session) throw new Error('Sign in again to continue.')
  const response = await fetch(clientApi.baseUrl() + path, { ...options, headers: { ...options.headers, Authorization: `Bearer ${session.accessToken}` }, cache: 'no-store' })
  if (response.status === 401) { window.FinStackTenantSession?.handleUnauthorized(); throw new Error('Your session expired. Sign in again.') }
  if (!response.ok) { const body = await response.json().catch(() => null); throw new Error(Array.isArray(body?.message) ? body.message.join(' ') : body?.message || 'The request could not be completed.') }
  return response
}
export function downloadCsv(value, name) {
  const url = URL.createObjectURL(value instanceof Blob ? value : new Blob([value], {type:'text/csv;charset=utf-8'}))
  const link = document.createElement('a'); link.href=url; link.download=name; link.click(); setTimeout(()=>URL.revokeObjectURL(url),1000)
}
export function safeCsvCell(value) { const text=String(value); return '"'+(/^(?:\s*[=+@\-]|[\t\r])/.test(text)?"'"+text:text).replaceAll('"','""')+'"' }
export const employeeImports = {
  list: () => clientApi.request(PATH),
  get: id => clientApi.request(`${PATH}/${id}`),
  rows: (id,page) => clientApi.request(`${PATH}/${id}/rows?page=${page}`),
  confirm: id => clientApi.request(`${PATH}/${id}/confirm`,{method:'POST'}),
  async upload(file,key) { const data=new FormData(); data.append('file',file); const response=await binaryRequest(PATH,{method:'POST',headers:{'idempotency-key':key},body:data}); return (await response.json()).data },
  async template() { downloadCsv(await (await binaryRequest(`${PATH}/template`)).blob(),'employee-import-template.csv') },
  async errors(id) { downloadCsv(await (await binaryRequest(`${PATH}/${id}/errors`)).blob(),'employee-import-errors.csv') },
  async activationLinks(id) {
    const response=await clientApi.request(`${PATH}/${id}/activation-links`,{method:'POST'})
    const rows=response.items.map(item=>[item.employeeId,item.email,`${window.location.origin}/activate-account.html#employeeId=${encodeURIComponent(item.employeeId)}&token=${item.token}`,response.expiresAt].map(safeCsvCell).join(','))
    downloadCsv('employeeId,email,activationLink,expiresAt\r\n'+rows.join('\r\n'),'employee-activation-links.csv')
    return response.items.length
  },
}
