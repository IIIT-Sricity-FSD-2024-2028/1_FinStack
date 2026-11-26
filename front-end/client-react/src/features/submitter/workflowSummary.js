// Server workflowStatus is authoritative; generic status=approved is not settlement.
export const reviewStates = new Set(['submitted', 'manager_review', 'finance_review', 'compliance_review', 'returned']);
export const approvedStates = new Set(['approved_for_payment', 'payment_processing', 'paid']);
export function summarizeWorkflow(expenses) {
  const counts = { pending: 0, approved: 0, processing: 0, paid: 0, draft: 0, rejected: 0, unknown: 0 };
  for (const expense of expenses) {
    const state = expense.workflowStatus || expense.status;
    if (reviewStates.has(state)) counts.pending++;
    else if (state === 'draft') counts.draft++;
    else if (state === 'rejected') counts.rejected++;
    else if (!approvedStates.has(state)) counts.unknown++;
    if (approvedStates.has(state)) counts.approved++;
    if (state === 'payment_processing') counts.processing++;
    if (state === 'paid') counts.paid++;
  }
  return counts;
}
