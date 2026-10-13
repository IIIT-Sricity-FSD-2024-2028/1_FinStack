export function Pagination({ page, pageSize, totalItems, onPageChange, itemLabel = 'items' }) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const start = totalItems ? (page - 1) * pageSize + 1 : 0
  const end = Math.min(page * pageSize, totalItems)

  return (
    <div className="pagination">
      <div className="pagination-info">
        {totalItems ? `Showing ${start}–${end} of ${totalItems} ${itemLabel}` : `No ${itemLabel} found`}
      </div>
      <div className="pagination-buttons">
        <button type="button" className="pagination-btn" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Previous</button>
        <button type="button" className="pagination-btn active" aria-current="page">{page}</button>
        <button type="button" className="pagination-btn" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>Next</button>
      </div>
    </div>
  )
}
