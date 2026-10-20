import { financeApi } from './financeApi.js'

// These endpoints record workflow requests. Settlement requires bank evidence;
// the published base does not yet define an evidence projection for the UI.
export async function submitTransactionAction(action, transactionId) {
  const actions = {
    process: ['processTransaction', 'Processing request recorded. Bank settlement remains unverified.'],
    fail: ['failTransaction', 'Failed payment request recorded.'],
    reconcile: ['reconcileTransaction', 'Reconciliation request recorded. Bank settlement remains unverified.'],
  }
  const config = actions[action]
  if (!config) throw new Error('Unsupported transaction action.')
  const transaction = await financeApi[config[0]](transactionId)
  return { transaction, message: config[1] }
}

export function transactionErrorMessage(error) {
  if (error?.status === 409 && error?.code === 'TENANT_BANK_EVIDENCE_REQUIRED') {
    return 'Bank evidence is required before this request can proceed. Payment completion has not been confirmed. Obtain verified bank evidence through the shared backend, then refresh and retry.'
  }
  return error?.message || 'Operation failed. Refresh and check the transaction state before retrying.'
}
