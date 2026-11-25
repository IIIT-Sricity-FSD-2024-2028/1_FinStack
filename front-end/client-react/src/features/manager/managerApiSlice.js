import { createApi } from "@reduxjs/toolkit/query/react";
import { request } from "../../services/session.ts";

const EXPENSES = "/api/v1/tenant/expenses";

const managerBaseQuery = async ({ url, method, body, ...options }, { signal, type }) => {
  try {
    return {
      data: await request(url, {
        ...options,
        method,
        body,
        signal,
        // Mutation tag invalidation refreshes this tab; keep the cross-tab signal only.
        ...(type === "mutation" ? { suppressLocalRefresh: true } : {}),
      }),
    };
  } catch (error) {
    return {
      error: {
        status: Number.isFinite(error?.status) ? error.status : "CUSTOM_ERROR",
        data: {
          message: error instanceof Error ? error.message : "The request failed.",
          ...(error?.code ? { code: error.code } : {}),
        },
      },
    };
  }
};

const asArray = (value) => Array.isArray(value) ? value : [];
const decisionInvalidatesTags = (_result, error, { id }) => error ? [] : [
  { type: "ManagerQueue", id: "LIST" },
  { type: "ManagerHistory", id: "LIST" },
  { type: "ManagerQueue", id },
  { type: "ManagerHistory", id },
];

export const managerApiSlice = createApi({
  reducerPath: "managerApi",
  baseQuery: managerBaseQuery,
  tagTypes: ["ManagerQueue", "ManagerHistory"],
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
    }),
    approveExpense: builder.mutation({
      query: ({ id, body }) => ({
        url: `${EXPENSES}/${encodeURIComponent(id)}/manager/approve`,
        method: "POST",
        body,
      }),
      invalidatesTags: decisionInvalidatesTags,
    }),
    rejectExpense: builder.mutation({
      query: ({ id, note }) => ({
        url: `${EXPENSES}/${encodeURIComponent(id)}/manager/reject`,
        method: "POST",
        body: { note },
      }),
      invalidatesTags: decisionInvalidatesTags,
    }),
    returnExpense: builder.mutation({
      query: ({ id, note }) => ({
        url: `${EXPENSES}/${encodeURIComponent(id)}/manager/return`,
        method: "POST",
        body: { note },
      }),
      invalidatesTags: decisionInvalidatesTags,
    }),
    escalateExpense: builder.mutation({
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
  useApproveExpenseMutation,
  useRejectExpenseMutation,
  useReturnExpenseMutation,
  useEscalateExpenseMutation,
} = managerApiSlice;
