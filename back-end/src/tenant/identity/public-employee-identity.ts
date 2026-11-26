// Tenant HTTP boundary only; service identities keep historical relationship keys.
export function publicEmployeeIdentity<T>(value: T): T {
  if (Array.isArray(value)) return value.map(publicEmployeeIdentity) as T;
  if (
    !value ||
    typeof value !== 'object' ||
    Object.getPrototypeOf(value) !== Object.prototype
  )
    return value;
  const row: Record<string, unknown> = Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      publicEmployeeIdentity(item),
    ]),
  );
  if (typeof row.canonicalEmployeeId === 'string' && row.canonicalEmployeeId) {
    row.employeeId = row.canonicalEmployeeId;
    delete row.canonicalEmployeeId;
  }
  if (
    typeof row.managerCanonicalEmployeeId === 'string' &&
    row.managerCanonicalEmployeeId
  ) {
    row.managerEmployeeId = row.managerCanonicalEmployeeId;
    delete row.managerCanonicalEmployeeId;
  }
  return row as T;
}
