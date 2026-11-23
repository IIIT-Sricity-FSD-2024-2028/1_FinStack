import { createApi } from "@reduxjs/toolkit/query/react";
import { request } from "../../services/session.ts";

const EXPENSES = "/api/v1/tenant/expenses";

const managerBaseQuery = async ({ url }, { signal }) => {
  try {
    return { data: await request(url, { signal }) };
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

export const managerApiSlice = createApi({
  reducerPath: "managerApi",
  baseQuery: managerBaseQuery,
  endpoints: (builder) => ({
    getManagerQueue: builder.query({
      query: () => ({ url: `${EXPENSES}/manager/queue` }),
      transformResponse: asArray,
    }),
    getManagerHistory: builder.query({
      query: () => ({ url: `${EXPENSES}/manager/history` }),
      transformResponse: asArray,
    }),
    getFinanceOfficers: builder.query({
      query: () => ({ url: `${EXPENSES}/manager/finance-officers` }),
      transformResponse: asArray,
    }),
  }),
});

export const {
  useGetManagerQueueQuery,
  useGetManagerHistoryQuery,
  useGetFinanceOfficersQuery,
} = managerApiSlice;
