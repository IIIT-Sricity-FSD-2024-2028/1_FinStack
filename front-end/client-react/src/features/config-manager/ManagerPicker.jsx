import { useEffect, useState } from 'react'
import { configManagerResources } from '../../adapters/configManagerResources'
import { useEmployeePage } from '../../hooks/useEmployeePage'
const loadManagers = params => configManagerResources.users.managers(params)
export function ManagerPicker({value,onChange}) {
  const [search,setSearch] = useState('')
  const [params,setParams] = useState({page:1,search:''})
  const [selected,setSelected] = useState(null)
  const resource=useEmployeePage(loadManagers,params)
  useEffect(()=>{const timer=setTimeout(()=>setParams(current=>current.search===search.trim()?current:{page:1,search:search.trim()}),300);return()=>clearTimeout(timer)},[search])
  const items=resource.status==='success'?resource.data.items:[]
  return <div><label className="form-label" htmlFor="manage-user-manager-search">Find manager</label><input id="manage-user-manager-search" className="form-input" type="search" maxLength={120} value={search} onChange={event=>setSearch(event.target.value)} placeholder="Search active managers" />
    <label className="form-label" htmlFor="manage-user-manager">Assign Manager</label><select id="manage-user-manager" className="form-input" value={value} onChange={event=>{const id=event.target.value;setSelected(items.find(item=>item.id===id)||null);onChange(id)}}><option value="">No manager</option>{selected&&value&&!items.some(item=>item.id===value)&&<option value={selected.id}>{selected.fullName} ({selected.employeeId})</option>}{items.map(item=><option key={item.id} value={item.id}>{item.fullName} ({item.employeeId})</option>)}</select>
    {resource.status==='loading'&&<p role="status">Loading managers...</p>}{resource.status==='error'&&<p role="alert">Managers could not be loaded. <button type="button" onClick={resource.refresh}>Retry managers</button></p>}{resource.status==='success'&&<><p>{resource.data.total?`${resource.data.total} active managers · Page ${params.page} of ${resource.data.totalPages}`:'No active managers match.'}</p><div className="import-actions"><button type="button" className="btn btn-secondary" disabled={params.page===1} onClick={()=>setParams(current=>({...current,page:current.page-1}))}>Previous managers</button><button type="button" className="btn btn-secondary" disabled={!resource.data.hasNextPage} onClick={()=>setParams(current=>({...current,page:current.page+1}))}>Next managers</button></div></>}
  </div>
}
