import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { selectSessionScope } from '../../app/sessionSlice.js'
import { configManagerApi } from './configManagerApi.js'

export function asError(error) {
  return Object.assign(new Error(error?.message || 'The request could not be completed.'), error)
}

// Preserve the resource interface used by the existing views. RTK Query owns
// data, subscription lifetimes, request deduplication and stale-argument safety.
export function useConfigResource(name, args, options = {}) {
  const scope = useSelector(selectSessionScope)
  const result = configManagerApi.endpoints[name].useQuery({ scope, args }, options)
  const key = JSON.stringify({ scope, args })
  const activeKey = useRef(key)
  activeKey.current = key
  const mounted = useRef(false)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])
  const [foreground, setForeground] = useState(null)
  const refresh = useCallback(async () => {
    setForeground({ key, pending: true })
    try {
      const data = await result.refetch().unwrap()
      if (mounted.current && activeKey.current === key) setForeground(null)
      return data
    } catch (error) {
      if (mounted.current && activeKey.current === key) setForeground({ key, error: asError(error) })
      return undefined
    }
  }, [result.refetch, key])
  const data = result.currentData
  const explicit = foreground?.key === key ? foreground : null
  const error = (explicit?.error && !result.isSuccess ? explicit.error : null) ||
    (data === undefined && result.isError ? asError(result.error) : null)
  return {
    status: explicit?.pending ? 'loading' : error ? 'error' : data === undefined ? 'loading' : 'success',
    data: error ? null : data ?? null,
    error,
    refresh,
  }
}

// Imperative event handlers can await the same query cache without retaining
// subscriptions or mutation results (which may contain provisioning feedback).
export function useConfigCommands() {
  const dispatch = useDispatch()
  const scope = useSelector(selectSessionScope)
  return useMemo(() => createConfigCommands(dispatch, scope), [dispatch, scope])
}

export function createConfigCommands(dispatch, scope) {
  const query = async (name, args, forceRefetch = true, signal) => {
    const operation = dispatch(configManagerApi.endpoints[name].initiate({ scope, args }, { subscribe: false, forceRefetch }))
    const abort = () => operation.abort()
    signal?.addEventListener('abort', abort, { once: true })
    if (signal?.aborted) abort()
    try { return await operation.unwrap() } catch (error) { throw asError(error) }
    finally { signal?.removeEventListener('abort', abort) }
  }
  const mutate = async (name, args) => {
    const operation = dispatch(configManagerApi.endpoints[name].initiate({ scope, args }))
    try { return await operation.unwrap() } catch (error) { throw asError(error) }
    finally { operation.reset() }
  }
  return { query, mutate,
    users: { create: value => mutate('createEmployee', value),
      update: (...args) => mutate('updateEmployee', args),
      updateStatus: (...args) => mutate('employeeStatus', args) },
    hierarchy: { updateManager: (...args) => mutate('updateManager', args) },
    categories: { create: value => mutate('createCategory', value),
      update: (...args) => mutate('updateCategory', args), delete: id => mutate('deleteCategory', id) },
    policies: { create: value => mutate('createPolicy', value),
      update: (...args) => mutate('updatePolicy', args), delete: id => mutate('deletePolicy', id) },
    templates: { activateCategories: value => mutate('activateCategories', value),
      activatePolicies: value => mutate('activatePolicies', value) },
  }
}
