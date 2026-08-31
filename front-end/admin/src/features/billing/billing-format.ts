export function formatMoney(currency: string | null | undefined, amount: string | number | null | undefined) {
  const value = Number(amount ?? 0);
  return `${currency || 'INR'} ${value.toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })}`;
}

export function formatDate(value?: string | null) {
  if (!value) return 'Not provided';
  return new Date(value).toLocaleDateString();
}

export function formatStatus(status?: string | null) {
  if (!status) return 'Unknown';
  return status
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
