export function Table({ children, className = '' }) {
  return <table className={`data-table ${className}`.trim()}>{children}</table>
}
