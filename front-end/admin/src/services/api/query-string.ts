export function queryString(
  query: object,
): string {
  const params = new URLSearchParams();
  (Object.entries(query) as Array<[string, unknown]>).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      params.set(key, String(value));
    }
  });
  const text = params.toString();
  return text ? `?${text}` : '';
}
