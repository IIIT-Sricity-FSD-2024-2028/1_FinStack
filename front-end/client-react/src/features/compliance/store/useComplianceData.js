import { useEffect } from 'react'
import { shallowEqual, useDispatch, useSelector } from 'react-redux'
import { fetchComplianceResource, pageQueryChanged, queryKey, refreshResources, resourceStatus } from './complianceSlice.js'

// Reads are deduplicated in the thunk. Cached definitions survive page navigation;
// background refresh keeps valid data and its independently owned error visible.
export function useComplianceData(names, optional = []) {
  const dispatch = useDispatch()
  const key = names.join(',')
  const generation = useSelector((state) => state.compliance.session.generation)
  const entries = useSelector((state) => names.map((name) => state.compliance[name]), shallowEqual)
  useEffect(() => {
    for (const name of key.split(',')) dispatch(fetchComplianceResource({ resource: name }))
  }, [dispatch, key, generation])
  const refreshNow = () => dispatch(refreshResources(names))
  const requiredEntries = entries.filter((_, index) => !optional.includes(names[index]))
  const optionalError = entries.filter((_, index) => optional.includes(names[index]))
    .map((entry) => entry.error).filter(Boolean).join(' ')
  return { ...resourceStatus(requiredEntries), optionalError, refreshNow, retryNow: refreshNow }
}

export function useCompliancePage(name, query) {
  const dispatch = useDispatch()
  const key = queryKey(query)
  const generation = useSelector((state) => state.compliance.session.generation)
  const entry = useSelector((state) => state.compliance[name])
  useEffect(() => {
    dispatch(pageQueryChanged({ name, query }))
    dispatch(fetchComplianceResource({ resource: name, query, force: true }))
    // The canonical key captures every server query parameter, independently of
    // the calling component's object identity.
  }, [dispatch, name, key, generation])
  const current = entry.key === key
  const refreshNow = () => dispatch(fetchComplianceResource({ resource: name, query, force: true }))
  return { data: current ? entry.data : { items: [], total: 0, totalPages: 1 },
    ...resourceStatus(current ? [entry] : [{ loaded: false, error: '' }]),
    refreshNow, retryNow: refreshNow }
}
