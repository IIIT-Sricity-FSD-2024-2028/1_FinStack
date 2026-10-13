import { useEffect } from 'react'
import { ToastHost } from '../components/ToastHost'

// The legacy shell remains the shared navigation contract during incremental migration.
export function WorkspaceShell({ workspace, breadcrumb, initializeLegacyShell = false, children }) {
  useEffect(() => {
    if (initializeLegacyShell && typeof window.initLayout === 'function') window.initLayout(breadcrumb)
  }, [breadcrumb, initializeLegacyShell])

  return (
    <div data-client-react-shell={workspace} style={{ display: 'contents' }}>
      {children}
      <ToastHost />
    </div>
  )
}
