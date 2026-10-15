const unavailableCurrency = 'Currency unavailable'

function minorUnits(value) {
  const text = String(value ?? '')
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) return null
  const [whole, fraction = ''] = text.split('.')
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'))
}

function currencyLabel(currency) {
  return typeof currency === 'string' && /^[A-Za-z]{3}$/.test(currency)
    ? currency.toUpperCase() : unavailableCurrency
}

function displayMinorUnits(amount, currency) {
  if (amount === null) return `${currency}: amount unavailable`
  return `${currency} ${(amount / 100n).toLocaleString('en-IN')}.${String(amount % 100n).padStart(2, '0')}`
}

export function formatExpenseAmount(record) {
  return displayMinorUnits(minorUnits(record.amountExact ?? record.amount), currencyLabel(record.currency))
}

export function formatCurrencyTotals(records) {
  const totals = new Map()
  for (const record of records) {
    const currency = currencyLabel(record.currency)
    const amount = minorUnits(record.amountExact ?? record.amount)
    const previous = totals.get(currency) ?? 0n
    totals.set(currency, amount === null || totals.get(currency) === null ? null : previous + amount)
  }
  return [...totals].sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, amount]) => displayMinorUnits(amount, currency)).join(' · ') || 'No amounts'
}

export function activePolicies(records) {
  return Array.isArray(records) ? records.filter((record) => record.status === 'Active') : []
}

export function profileField(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : 'Unavailable in current profile'
}

export function managerProfileField(manager) {
  const name = [manager?.firstName, manager?.lastName].filter(Boolean).join(' ').trim()
  return profileField([name, manager?.employeeId ? `(${manager.employeeId})` : ''].filter(Boolean).join(' '))
}
