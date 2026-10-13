import { isEmail } from 'class-validator';
export const IMPORT_HEADERS = [
  'employeeId',
  'firstName',
  'lastName',
  'email',
  'department',
  'role',
  'managerEmployeeId',
];
export const IMPORT_LIMIT = 10000;
export const IMPORT_BATCH = 200;
export type ImportPayload = {
  firstName: string;
  lastName: string;
  department: string;
  managerEmployeeId: string;
};
export function validateEmployeeRow(raw: Record<string, string>) {
  const employeeId = (raw.employeeId || '').trim(),
    email = (raw.email || '').trim().toLowerCase();
  const payload: ImportPayload = {
    firstName: (raw.firstName || '').trim(),
    lastName: (raw.lastName || '').trim(),
    department: (raw.department || '').trim() || 'General',
    managerEmployeeId: (raw.managerEmployeeId || '').trim(),
  };
  const errors: string[] = [];
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(employeeId))
    errors.push(
      'Employee ID must use the existing 1–80 character letters/digits/period/underscore/hyphen format.',
    );
  for (const field of ['firstName', 'lastName'] as const)
    if (
      !payload[field] ||
      payload[field].length > 100 ||
      /[\p{Cc}\p{Cf}]/u.test(payload[field])
    )
      errors.push(
        `${field} requires 1–100 characters without control characters.`,
      );
  if (!isEmail(email) || email.length > 320)
    errors.push('A valid email of at most 320 characters is required.');
  if (
    payload.department.length > 120 ||
    /[\p{Cc}\p{Cf}]/u.test(payload.department)
  )
    errors.push(
      'Department must contain at most 120 characters without control characters.',
    );
  if (raw.role && raw.role.trim() !== 'EXPENSE_SUBMITTER')
    errors.push(
      'Bulk import permits EXPENSE_SUBMITTER only. Assign privileged roles through authorized manual provisioning.',
    );
  if (
    payload.managerEmployeeId &&
    (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(payload.managerEmployeeId) ||
      payload.managerEmployeeId === employeeId)
  )
    errors.push('Manager employee ID is invalid or refers to this employee.');
  return {
    employeeId: employeeId.replaceAll('\u0000', '').slice(0, 80),
    email: email.replaceAll('\u0000', '').slice(0, 320),
    payload: Object.fromEntries(
      Object.entries(payload).map(([key, value]) => [
        key,
        value.replaceAll('\u0000', ''),
      ]),
    ) as ImportPayload,
    errors,
  };
}
export function csvCell(value: string) {
  const safe = /^(?:\s*[=+@-]|[\t\r])/.test(value) ? "'" + value : value;
  return '"' + safe.replaceAll('"', '""') + '"';
}
