import { createSlice } from '@reduxjs/toolkit'

const initialState = {
  review: { search: '', stageFilter: 'finance_review', categoryFilter: '', sortKey: 'date_desc', page: 1 },
  transactions: { search: '', statusFilter: 'all' },
  notifications: { page: 1, stateFilter: 'all' },
}

export const financeSlice = createSlice({
  name: 'finance',
  initialState,
  reducers: {
    setReviewFilter(state, { payload }) {
      Object.assign(state.review, payload, { page: 1 })
    },
    setReviewPage(state, { payload }) { state.review.page = payload },
    setTransactionFilter(state, { payload }) { Object.assign(state.transactions, payload) },
    setNotificationPage(state, { payload }) { state.notifications.page = payload },
    setNotificationFilter(state, { payload }) {
      state.notifications.stateFilter = payload
      state.notifications.page = 1
    },
    resetFinance: () => initialState,
  },
})

export const {
  setReviewFilter, setReviewPage, setTransactionFilter,
  setNotificationFilter, setNotificationPage, resetFinance,
} = financeSlice.actions
