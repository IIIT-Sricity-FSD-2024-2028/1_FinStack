import { useEffect, useState } from 'react'

export function useLegacyStoreData(loader) {
  const [state, setState] = useState({ status: 'loading', data: null, error: null })
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let active = true
    setState((current) => ({ ...current, status: 'loading', error: null }))
    Promise.resolve(loader())
      .then((data) => { if (active) setState({ status: 'success', data, error: null }) })
      .catch((error) => { if (active) setState({ status: 'error', data: null, error }) })
    return () => { active = false }
  }, [loader, version])

  return { ...state, refresh: () => setVersion((value) => value + 1) }
}
