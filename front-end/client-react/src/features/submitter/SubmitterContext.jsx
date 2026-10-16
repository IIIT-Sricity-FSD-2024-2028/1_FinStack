import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth } from "../../auth/AuthContext";
import { submitterApi } from "./api/submitterApi";
import { useLiveRefresh } from "../../hooks/useLiveRefresh";

const SubmitterContext = createContext(null);
const initialResource = { loading: true, error: "" };

export function SubmitterProvider({ children }) {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [expenseState, setExpenseState] = useState(initialResource);
  const [categoryState, setCategoryState] = useState(initialResource);
  const [notificationState, setNotificationState] = useState(initialResource);
  const generations = useRef({ expenses: 0, categories: 0, notifications: 0 });

  const refreshExpenses = useCallback(async ({ background = false } = {}) => {
    const generation = ++generations.current.expenses;
    if (!background) setExpenseState({ loading: true, error: "" });
    try {
      const next = await submitterApi.getMyExpenses();
      if (generation !== generations.current.expenses) return;
      setExpenses(next);
      setExpenseState({ loading: false, error: "" });
    } catch (error) {
      if (generation !== generations.current.expenses) return;
      if (background) throw error;
      setExpenseState({
        loading: false,
        error: error.message || "Unable to load expenses.",
      });
    }
  }, []);

  const refreshCategories = useCallback(async ({ background = false } = {}) => {
    const generation = ++generations.current.categories;
    if (!background) setCategoryState({ loading: true, error: "" });
    try {
      const next = await submitterApi.getCategories();
      if (generation !== generations.current.categories) return;
      setCategories(next);
      setCategoryState({ loading: false, error: "" });
    } catch (error) {
      if (generation !== generations.current.categories) return;
      if (background) throw error;
      setCategoryState({
        loading: false,
        error: error.message || "Unable to load categories.",
      });
    }
  }, []);

  const refreshNotifications = useCallback(async ({ background = false } = {}) => {
    const generation = ++generations.current.notifications;
    if (!background) setNotificationState({ loading: true, error: "" });
    try {
      const page = await submitterApi.getNotifications();
      if (generation !== generations.current.notifications) return;
      setNotifications(page.items);
      setNotificationState({ loading: false, error: "" });
    } catch (error) {
      if (generation !== generations.current.notifications) return;
      if (background) throw error;
      setNotificationState({
        loading: false,
        error: error.message || "Unable to load notifications.",
      });
    }
  }, []);

  const refresh = useCallback(
    () =>
      Promise.allSettled([
        refreshExpenses(),
        refreshCategories(),
        refreshNotifications(),
      ]),
    [refreshExpenses, refreshCategories, refreshNotifications],
  );
  useEffect(() => {
    refresh();
  }, [refresh]);

  useLiveRefresh(
    ({ background }) => Promise.all([
      refreshExpenses({ background }),
      refreshCategories({ background }),
      refreshNotifications({ background }),
    ]),
    { refreshImmediately: false },
  );

  const fullName = `${user?.firstName || ""} ${user?.lastName || ""}`.trim();
  const value = useMemo(
    () => ({
      user: user ? { ...user, fullName } : null,
      expenses,
      categories,
      notifications,
      expenseState,
      categoryState,
      notificationState,
      refresh,
      refreshExpenses,
      refreshCategories,
      refreshNotifications,
    }),
    [
      user,
      fullName,
      expenses,
      categories,
      notifications,
      expenseState,
      categoryState,
      notificationState,
      refresh,
      refreshExpenses,
      refreshCategories,
      refreshNotifications,
    ],
  );

  return (
    <SubmitterContext.Provider value={value}>
      {children}
    </SubmitterContext.Provider>
  );
}

export function useSubmitter() {
  const value = useContext(SubmitterContext);

  if (!value) {
    throw new Error("SubmitterProvider is required.");
  }

  return value;
}
