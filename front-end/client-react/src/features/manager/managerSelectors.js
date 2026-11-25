import { createSelector } from "@reduxjs/toolkit";
import { managerApiSlice } from "./managerApiSlice.js";

const EMPTY_LIST = [];

const selectQueueQuery = managerApiSlice.endpoints.getManagerQueue.select();
const selectHistoryQuery = managerApiSlice.endpoints.getManagerHistory.select();
const selectQueueFilters = (state) => state.managerFilters.queue;
const selectHistoryFilters = (state) => state.managerFilters.history;

export const selectManagerQueue = createSelector(
  [selectQueueQuery],
  (query) => Array.isArray(query.data) ? query.data : EMPTY_LIST,
);

// The Manager queue endpoint returns only items pending Manager review.
export const selectPendingManagerExpenses = selectManagerQueue;

export const selectPendingManagerCount = createSelector(
  [selectPendingManagerExpenses],
  (queue) => queue.length,
);

export function riskLevel(score) {
  return (score ?? 0) >= 70 ? "High" : (score ?? 0) >= 40 ? "Medium" : "Low";
}

export const selectFilteredManagerQueue = createSelector(
  [selectManagerQueue, selectQueueFilters],
  (queue, filters) => queue.filter((expense) => {
    const text = [expense.id, expense.merchant, expense.category, expense.employee?.fullName, expense.employeeId].join(" ").toLowerCase();
    const risk = riskLevel(expense.riskScore).toLowerCase();
    return text.includes(filters.search.trim().toLowerCase()) &&
      (filters.flag === "all" || Boolean(expense.flag) === (filters.flag === "flagged")) &&
      (filters.risk === "all" || risk === filters.risk);
  }),
);

export const selectTopPendingManagerExpenses = createSelector(
  [selectPendingManagerExpenses],
  (queue) => [...queue].sort((a, b) => (b.riskScore ?? 0) - (a.riskScore ?? 0)).slice(0, 5),
);

export const selectHighRiskManagerExpenses = createSelector(
  [selectPendingManagerExpenses],
  (queue) => queue.filter((expense) => (expense.riskScore ?? 0) >= 70),
);

export const selectManagerHistory = createSelector(
  [selectHistoryQuery],
  (query) => Array.isArray(query.data) ? query.data : EMPTY_LIST,
);

export function decisionStatus(expense) {
  const decision = String(expense.managerDecision || "").toLowerCase();
  if (decision.includes("escalat")) return "Escalated";
  if (decision.includes("return")) return "Returned";
  if (decision.includes("reject")) return "Rejected";
  if (decision.includes("approv")) return "Approved";
  const workflow = String(expense.workflowStatus || "").toLowerCase();
  if (workflow.includes("compliance")) return "Escalated";
  return workflow || "Processed";
}

export const selectFilteredManagerHistory = createSelector(
  [selectManagerHistory, selectHistoryFilters],
  (history, filters) => history.filter((expense) => {
    const matchesStatus = filters.status === "all" || decisionStatus(expense) === filters.status;
    const text = [expense.id, expense.merchant, expense.category, expense.employee?.fullName, expense.employeeId].join(" ").toLowerCase();
    return matchesStatus && text.includes(filters.search.trim().toLowerCase());
  }),
);
