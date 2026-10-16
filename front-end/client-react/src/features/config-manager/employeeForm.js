export const EMPLOYEE_ROLES = [
  "expense_submitter",
  "manager",
  "finance_officer",
  "compliance_officer",
  "configuration_manager",
];
export function employeeErrors(values, editing = false) {
  const errors = {};
  for (const field of ["firstName", "lastName"]) {
    const value = String(values[field] || "").trim();
    if (!value || value.length > 100 || /[\p{Cc}\p{Cf}]/u.test(value))
      errors[field] = "Enter 1–100 characters without control characters.";
  }
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim()) ||
    values.email.trim().length > 320
  )
    errors.email = "Enter a valid email address (up to 320 characters).";
  if (
    !editing &&
    values.employeeId?.trim() &&
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(values.employeeId.trim())
  )
    errors.employeeId =
      "Use 1–80 letters, digits, periods, underscores or hyphens; start with a letter or digit.";
  if (
    values.department.trim().length > 120 ||
    /[\p{Cc}\p{Cf}]/u.test(values.department)
  )
    errors.department = "Use up to 120 characters without control characters.";
  if (!EMPLOYEE_ROLES.includes(values.roles[0]))
    errors.roles = "Choose an available role.";
  if (!editing && (values.password.length < 8 || values.password.length > 200))
    errors.password = "Use 8–200 characters. Share the password securely.";
  return errors;
}
export function employeeFailure(message = "") {
  if (/unavailable|already exists|duplicate/i.test(message))
    return {
      employeeId: "Check the Employee ID is available globally.",
      email: "Check this email is not already used in your organization.",
    };
  if (/manager|reporting|cycle/i.test(message))
    return {
      managerId:
        "Choose an eligible active employee from this organization. Reporting links cannot create a cycle.",
    };
  return {
    form: "The account could not be saved. Check the fields and retry. Refresh if your access has changed.",
  };
}
export const peopleLabel = (count) =>
  `${count} ${count === 1 ? "employee" : "employees"}`;
