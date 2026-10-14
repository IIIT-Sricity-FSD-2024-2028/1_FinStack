export const currency = (value, code = 'INR') => new Intl.NumberFormat('en-IN', { style: 'currency', currency: code }).format(Number(value || 0))
export const date = (value) => value ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(value)) : '-'
export const initials = (value = '') => value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'ES'
export const timeAgo = (value) => {
  if (!value) return ''
  const seconds = Math.round((new Date(value).getTime() - Date.now()) / 1000)
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  if (Math.abs(seconds) < 60) return formatter.format(seconds, 'second')
  const minutes = Math.round(seconds / 60)
  if (Math.abs(minutes) < 60) return formatter.format(minutes, 'minute')
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) return formatter.format(hours, 'hour')
  return formatter.format(Math.round(hours / 24), 'day')
}
export const formatExpenseId = (value) => String(value || '').slice(0, 8).toUpperCase()
export const workflowLabel = (expense) => String(expense.workflowStatus || expense.status || 'submitted').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
export const workflowClass = (expense) => {
  const state = String(expense.workflowStatus || expense.status || '').toLowerCase()
  if (state.includes('reject')) return 'badge-danger'
  if (['paid', 'approved_for_payment', 'finance_approved', 'compliance_approved'].includes(state)) return 'badge-success'
  if (state.includes('return') || state.includes('review') || state.includes('processing')) return 'badge-warning'
  return 'badge-info'
}
