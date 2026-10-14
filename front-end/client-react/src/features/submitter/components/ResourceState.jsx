export default function ResourceState({
  loading,
  error,
  onRetry,
  empty,
  children,
}) {
  if (loading)
    return (
      <div className="submitter-state" role="status">
        <span className="submitter-spinner" />
        Loading…
      </div>
    );
  if (error)
    return (
      <div className="submitter-state submitter-state-error" role="alert">
        <p>{error}</p>
        <button className="btn btn-primary" type="button" onClick={onRetry}>
          Try again
        </button>
      </div>
    );
  if (empty) return <div className="submitter-state">{empty}</div>;
  return children;
}
