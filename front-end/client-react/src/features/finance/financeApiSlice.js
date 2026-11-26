import { tenantApi, tenantBaseQuery } from '../../app/api.js'

export const financeBaseQuery = (descriptor, api) => tenantBaseQuery({ ...descriptor, channel: 'finance' }, api)

const financialTags = ['FinanceWorkspace', 'FinanceQueue', 'FinanceNotifications']
const invalidateOnSuccess = (tags) => (_result, error) => error ? [] : tags
const query = (operation, args = []) => ({ channel: 'finance', operation, args })

export const financeApiSlice = tenantApi.injectEndpoints({
  endpoints: (build) => ({
    financeWorkspace: build.query({
      query: () => query('getFinanceWorkspace'),
      providesTags: ['FinanceWorkspace'],
    }),
    financeQueue: build.query({
      query: () => query('getFinanceQueue'),
      providesTags: ['FinanceQueue'],
    }),
    financeCategories: build.query({
      query: () => query('getCategories'),
      providesTags: ['FinanceCategories'],
    }),
    financePolicies: build.query({
      query: () => query('getPolicies'),
      providesTags: ['FinancePolicies'],
    }),
    financeNotifications: build.query({
      query: (filters) => query('getNotifications', [filters]),
      providesTags: ['FinanceNotifications'],
    }),
    financeUnreadCount: build.query({
      query: () => query('getUnreadNotificationCount'),
      providesTags: ['FinanceNotifications'],
    }),
    financeApproveExpense: build.mutation({
      query: ({ expenseId, note }) => query('approveExpense', [expenseId, note]),
      invalidatesTags: invalidateOnSuccess(financialTags),
    }),
    financeRejectExpense: build.mutation({
      query: ({ expenseId, note }) => query('rejectExpense', [expenseId, note]),
      invalidatesTags: invalidateOnSuccess(financialTags),
    }),
    financeRequestInfoExpense: build.mutation({
      query: ({ expenseId, note }) => query('requestInfoExpense', [expenseId, note]),
      invalidatesTags: invalidateOnSuccess(financialTags),
    }),
    financeFlagExpense: build.mutation({
      query: ({ expenseId, note }) => query('flagExpense', [expenseId, note]),
      invalidatesTags: invalidateOnSuccess(financialTags),
    }),
    financeReleasePayment: build.mutation({
      query: (expenseIds) => query('releasePayment', [expenseIds]),
      invalidatesTags: invalidateOnSuccess(financialTags),
    }),
    financeProcessTransaction: build.mutation({
      query: (id) => query('processTransaction', [id]),
      invalidatesTags: invalidateOnSuccess(financialTags),
    }),
    financeFailTransaction: build.mutation({
      query: (id) => query('failTransaction', [id]),
      invalidatesTags: invalidateOnSuccess(financialTags),
    }),
    financeReconcileTransaction: build.mutation({
      query: (id) => query('reconcileTransaction', [id]),
      invalidatesTags: invalidateOnSuccess(financialTags),
    }),
    markFinanceNotificationRead: build.mutation({
      query: (id) => query('markNotificationRead', [id]),
      invalidatesTags: invalidateOnSuccess(['FinanceNotifications']),
    }),
    markAllFinanceNotificationsRead: build.mutation({
      query: () => query('markAllNotificationsRead'),
      invalidatesTags: invalidateOnSuccess(['FinanceNotifications']),
    }),
  }),
})

export const {
  useFinanceWorkspaceQuery: financeWorkspaceQuery,
  useFinanceCategoriesQuery: financeCategoriesQuery,
  useFinanceNotificationsQuery: financeNotificationsQuery,
  useFinanceUnreadCountQuery: financeUnreadCountQuery,
  useFinanceApproveExpenseMutation: useApproveExpenseMutation,
  useFinanceRejectExpenseMutation: useRejectExpenseMutation,
  useFinanceRequestInfoExpenseMutation: useRequestInfoExpenseMutation,
  useFinanceFlagExpenseMutation: useFlagExpenseMutation,
  useFinanceReleasePaymentMutation: useReleasePaymentMutation,
  useFinanceProcessTransactionMutation: useProcessTransactionMutation,
  useFinanceFailTransactionMutation: useFailTransactionMutation,
  useFinanceReconcileTransactionMutation: useReconcileTransactionMutation,
  useMarkFinanceNotificationReadMutation,
  useMarkAllFinanceNotificationsReadMutation,
} = financeApiSlice

export const useFinanceWorkspaceQuery = (arg, options) => financeWorkspaceQuery(arg, {
  refetchOnFocus: true, refetchOnReconnect: true, ...options,
})

export const useFinanceCategoriesQuery = (arg, options) => financeCategoriesQuery(arg, {
  refetchOnFocus: true, refetchOnReconnect: true, ...options,
})

export const useFinanceNotificationsQuery = (arg, options) => financeNotificationsQuery(arg, {
  refetchOnFocus: true, refetchOnReconnect: true, ...options,
})

export const useFinanceUnreadCountQuery = (arg, options) => financeUnreadCountQuery(arg, {
  refetchOnFocus: true, refetchOnReconnect: true, ...options,
})
