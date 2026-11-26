import { createApi } from '@reduxjs/toolkit/query/react'
import { financeApi as transport } from './financeApi.js'

// Keep the existing JWT transport, response unwrapping and session-expiry behavior.
// Errors in Redux must be plain objects, including the bank-evidence conflict code.
export async function financeBaseQuery({ operation, args = [] }, { signal }) {
  try {
    return { data: await transport[operation](...args, signal) }
  } catch (error) {
    return {
      error: {
        status: error.status || 'FETCH_ERROR',
        message: error.message || 'The service is unavailable. Please retry.',
        ...(error.code ? { code: error.code } : {}),
      },
    }
  }
}

const financialTags = ['FinanceWorkspace', 'FinanceQueue', 'FinanceNotifications']
const invalidateOnSuccess = (tags) => (_result, error) => error ? [] : tags
const query = (operation, args = []) => ({ operation, args })

export const financeApiSlice = createApi({
  reducerPath: 'financeApi',
  baseQuery: financeBaseQuery,
  tagTypes: [...financialTags, 'FinanceCategories', 'FinancePolicies'],
  refetchOnMountOrArgChange: true,
  refetchOnFocus: true,
  refetchOnReconnect: true,
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
    approveExpense: build.mutation({
      query: ({ expenseId, note }) => query('approveExpense', [expenseId, note]),
      invalidatesTags: invalidateOnSuccess(financialTags),
    }),
    rejectExpense: build.mutation({
      query: ({ expenseId, note }) => query('rejectExpense', [expenseId, note]),
      invalidatesTags: invalidateOnSuccess(financialTags),
    }),
    requestInfoExpense: build.mutation({
      query: ({ expenseId, note }) => query('requestInfoExpense', [expenseId, note]),
      invalidatesTags: invalidateOnSuccess(financialTags),
    }),
    flagExpense: build.mutation({
      query: ({ expenseId, note }) => query('flagExpense', [expenseId, note]),
      invalidatesTags: invalidateOnSuccess(financialTags),
    }),
    releasePayment: build.mutation({
      query: (expenseIds) => query('releasePayment', [expenseIds]),
      invalidatesTags: invalidateOnSuccess(financialTags),
    }),
    processTransaction: build.mutation({
      query: (id) => query('processTransaction', [id]),
      invalidatesTags: invalidateOnSuccess(financialTags),
    }),
    failTransaction: build.mutation({
      query: (id) => query('failTransaction', [id]),
      invalidatesTags: invalidateOnSuccess(financialTags),
    }),
    reconcileTransaction: build.mutation({
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
  useFinanceWorkspaceQuery,
  useFinanceCategoriesQuery,
  useFinanceNotificationsQuery,
  useFinanceUnreadCountQuery,
  useApproveExpenseMutation,
  useRejectExpenseMutation,
  useRequestInfoExpenseMutation,
  useFlagExpenseMutation,
  useReleasePaymentMutation,
  useProcessTransactionMutation,
  useFailTransactionMutation,
  useReconcileTransactionMutation,
  useMarkFinanceNotificationReadMutation,
  useMarkAllFinanceNotificationsReadMutation,
} = financeApiSlice
