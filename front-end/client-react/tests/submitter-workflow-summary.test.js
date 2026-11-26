import assert from 'node:assert/strict';
import { test } from 'node:test';
import { summarizeWorkflow } from '../src/features/submitter/workflowSummary.js';
const cases = [
  ['draft', 0, 0, 0, 0], ['manager_review', 1, 0, 0, 0], ['finance_review', 1, 0, 0, 0],
  ['compliance_review', 1, 0, 0, 0], ['returned', 1, 0, 0, 0], ['rejected', 0, 0, 0, 0],
  ['approved_for_payment', 0, 1, 0, 0], ['payment_processing', 0, 1, 1, 0], ['paid', 0, 1, 0, 1],
];
for (const [workflowStatus, pending, approved, processing, paid] of cases) {
  test(`dashboard uses authoritative ${workflowStatus} semantics`, () => {
    const result = summarizeWorkflow([{ workflowStatus, status: 'approved', managerDecision: 'Approved', complianceDecision: 'Approved' }]);
    assert.deepEqual([result.pending, result.approved, result.processing, result.paid], [pending, approved, processing, paid]);
  });
}
test('unknown and generic approved states do not fabricate clearance or settlement', () => {
  const result = summarizeWorkflow([{ workflowStatus: 'future_status', status: 'paid' }, { status: 'approved' }]);
  assert.equal(result.pending, 0); assert.equal(result.approved, 0); assert.equal(result.paid, 0); assert.equal(result.unknown, 2);
});
