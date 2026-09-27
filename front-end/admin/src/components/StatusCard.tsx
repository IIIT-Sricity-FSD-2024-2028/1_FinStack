interface StatusCardProps {
  label: string;
  status: 'available' | 'unavailable';
  detail: string;
}

export function StatusCard({ label, status, detail }: StatusCardProps) {
  return (
    <article className="status-card">
      <div className="status-card-heading">
        <span className={`status-dot status-dot-${status}`} aria-hidden="true" />
        <span className={`status-pill status-pill-${status}`}>{status}</span>
      </div>
      <h2>{label}</h2>
      <p>{detail}</p>
    </article>
  );
}
