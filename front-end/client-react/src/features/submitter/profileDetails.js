import { managerProfileField } from "../shared/expensePresentation.js";

export function submitterProfileDetails(user) {
  const manager = user?.manager === null ? "Not assigned" : managerProfileField(user?.manager);
  return [
    ["Name", user?.fullName],
    ["Email", user?.email],
    ["Employee ID", user?.employeeId],
    ["Department", user?.department],
    ["Manager", manager],
    ["Role", "Expense Submitter"],
    ["Organization", user?.organizationName],
    ["Account status", user?.status],
  ];
}
