export const MAX_PAYMENT_BATCH = 100
export const batchLimitMessage = 'A batch can contain at most 100 claims. Select claims individually or reduce the selection.'

export function validatePaymentBatch(ids) {
  if (!Array.isArray(ids) || ids.length === 0) throw new Error('Select at least one expense to release.')
  if (ids.length > MAX_PAYMENT_BATCH) throw new Error(batchLimitMessage)
}

export function togglePaymentSelection(current, id) {
  const next = new Set(current)
  if (next.has(id)) next.delete(id)
  else {
    if (next.size >= MAX_PAYMENT_BATCH) throw new Error(batchLimitMessage)
    next.add(id)
  }
  return next
}

export function selectAllPayments(current, ids) {
  if (ids.length > 0 && ids.every((id) => current.has(id))) return new Set()
  validatePaymentBatch(ids)
  return new Set(ids)
}
