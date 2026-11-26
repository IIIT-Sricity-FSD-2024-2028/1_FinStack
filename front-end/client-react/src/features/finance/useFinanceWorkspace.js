import { financeApiSlice, useFinanceWorkspaceQuery, useFinanceCategoriesQuery } from './financeApiSlice.js'

const emptyWorkspace = { expenses: [], transactions: [] }
const emptyCategories = []

export function useFinanceWorkspace() {
  const workspace = useFinanceWorkspaceQuery(undefined, { pollingInterval: 15_000, skipPollingIfUnfocused: true })
  const categories = useFinanceCategoriesQuery()
  const refreshNow = () => {
    workspace.refetch()
    categories.refetch()
  }
  return {
    data: workspace.data || emptyWorkspace,
    categories: categories.data || emptyCategories,
    loading: workspace.isLoading,
    error: !workspace.data && workspace.error ? workspace.error.message : '',
    refreshError: workspace.data && workspace.error,
    refreshNow,
    retryNow: refreshNow,
  }
}

// Details resolve from the same cache as lists and metrics after every mutation.
export function useFinanceExpense(expense, open) {
  const { currentData } = financeApiSlice.endpoints.financeWorkspace.useQueryState(undefined, { skip: !open })
  return currentData ? currentData.expenses?.find((item) => item.id === expense?.id) || null : expense
}
