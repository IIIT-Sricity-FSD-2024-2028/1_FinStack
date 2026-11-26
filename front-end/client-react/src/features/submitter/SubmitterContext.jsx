import { useDispatch, useSelector } from 'react-redux'
import { useAuth } from '../../auth/AuthContext'
import { selectExpenses, selectExpenseState, fetchExpenses } from './store/expensesSlice.js'
import { selectCategories, selectCategoryState, fetchCategories } from './store/categoriesSlice.js'
import { selectNotifications, selectNotificationState, fetchNotifications } from './store/notificationsSlice.js'
import { refreshSubmitter } from './store/submitterActions.js'
export { SubmitterReduxProvider as SubmitterProvider } from './store/SubmitterReduxProvider'

// Compatibility facade for existing consumers; no Context or second data cache.
export function useSubmitter() {
  const dispatch = useDispatch()
  const { user } = useAuth()
  return { user: user ? { ...user, fullName: `${user.firstName || ''} ${user.lastName || ''}`.trim() } : null,
    expenses: useSelector(selectExpenses), categories: useSelector(selectCategories), notifications: useSelector(selectNotifications),
    expenseState: useSelector(selectExpenseState), categoryState: useSelector(selectCategoryState), notificationState: useSelector(selectNotificationState),
    refresh: () => dispatch(refreshSubmitter()), refreshExpenses: options => dispatch(fetchExpenses(options)),
    refreshCategories: options => dispatch(fetchCategories(options)), refreshNotifications: options => dispatch(fetchNotifications(options)) }
}
