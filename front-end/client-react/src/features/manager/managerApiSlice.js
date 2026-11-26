import { tenantApi } from '../../app/api.js';
const EXPENSES = '/api/v1/tenant/expenses';

const asArray = (value) => Array.isArray(value) ? value : [];
const decisionInvalidatesTags = (_result, error, { id }) => error ? [] : [
  { type: "ManagerQueue", id: "LIST" },
  { type: "ManagerHistory", id: "LIST" },
  { type: "ManagerQueue", id },
  { type: "ManagerHistory", id },
];

export const managerApiSlice = tenantApi.injectEndpoints({
  endpoints: (builder) => ({
    getManagerQueue: builder.query({
      query: () => ({ url: `${EXPENSES}/manager/queue` }),
      transformResponse: asArray,
      providesTags: (result) => [
        { type: "ManagerQueue", id: "LIST" },
        ...(result || []).filter((expense) => expense?.id != null)
          .map((expense) => ({ type: "ManagerQueue", id: expense.id })),
      ],
    }),
    getManagerHistory: builder.query({
      query: () => ({ url: `${EXPENSES}/manager/history` }),
      transformResponse: asArray,
      providesTags: (result) => [
        { type: "ManagerHistory", id: "LIST" },
        ...(result || []).filter((expense) => expense?.id != null)
          .map((expense) => ({ type: "ManagerHistory", id: expense.id })),
      ],
    }),
    getFinanceOfficers: builder.query({
      query: () => ({ url: `${EXPENSES}/manager/finance-officers` }),
      transformResponse: asArray,
      providesTags: ['ManagerOfficers'],
    }),
    managerApproveExpense: builder.mutation({
      query: ({ id, body }) => ({
        url: `${EXPENSES}/${encodeURIComponent(id)}/manager/approve`,
        method: "POST",
        body,
      }),
      invalidatesTags: decisionInvalidatesTags,
    }),
    managerRejectExpense: builder.mutation({
      query: ({ id, note }) => ({
        url: `${EXPENSES}/${encodeURIComponent(id)}/manager/reject`,
        method: "POST",
        body: { note },
      }),
      invalidatesTags: decisionInvalidatesTags,
    }),
    managerReturnExpense: builder.mutation({
      query: ({ id, note }) => ({
        url: `${EXPENSES}/${encodeURIComponent(id)}/manager/return`,
        method: "POST",
        body: { note },
      }),
      invalidatesTags: decisionInvalidatesTags,
    }),
    managerEscalateExpense: builder.mutation({
      query: ({ id, note }) => ({
        url: `${EXPENSES}/${encodeURIComponent(id)}/manager/escalate`,
        method: "POST",
        body: { note },
      }),
      invalidatesTags: decisionInvalidatesTags,
    }),
  }),
});

export const {
  useGetManagerQueueQuery,
  useGetManagerHistoryQuery,
  useGetFinanceOfficersQuery,
  useManagerApproveExpenseMutation: useApproveExpenseMutation,
  useManagerRejectExpenseMutation: useRejectExpenseMutation,
  useManagerReturnExpenseMutation: useReturnExpenseMutation,
  useManagerEscalateExpenseMutation: useEscalateExpenseMutation,
} = managerApiSlice;
