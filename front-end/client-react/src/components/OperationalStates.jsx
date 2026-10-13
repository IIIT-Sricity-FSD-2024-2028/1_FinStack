export function EmptyState({ title = 'Nothing here yet', description = 'Content will appear here once data is available.' }) {
  return <div className="empty-state"><h3>{title}</h3><p>{description}</p></div>
}

export function LoadingState({ message = 'Loading…' }) {
  return <div className="empty-state" role="status"><p>{message}</p></div>
}

export function ErrorState({ title = 'Something went wrong', description = 'Please try again.', onRetry }) {
  return <div className="empty-state" role="alert"><h3>{title}</h3><p>{description}</p>{onRetry && <button type="button" className="btn btn-secondary" onClick={onRetry}>Try Again</button>}</div>
}
