import { combineReducers } from '@reduxjs/toolkit'
import expenses from './expensesSlice.js'
import categories from './categoriesSlice.js'
import notifications from './notificationsSlice.js'
import session from './submitterSession.js'

// Feature reducers only. Store construction belongs to app/store.js.
export const submitterReducer = combineReducers({ session, expenses, categories, notifications })
