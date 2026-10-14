import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAuth } from "../../auth/AuthContext";
import { submitterApi } from "./api/submitterApi";

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

  const refreshExpenses = useCallback(async () => {
    setExpenseState({ loading: true, error: "" });
    try {
      setExpenses(await submitterApi.getMyExpenses());
      setExpenseState({ loading: false, error: "" });
    } catch (error) {
      setExpenseState({
        loading: false,
        error: error.message || "Unable to load expenses.",
      });
    }
  }, []);

  const refreshCategories = useCallback(async () => {
    setCategoryState({ loading: true, error: "" });
    try {
      setCategories(await submitterApi.getCategories());
      setCategoryState({ loading: false, error: "" });
    } catch (error) {
      setCategoryState({
        loading: false,
        error: error.message || "Unable to load categories.",
      });
    }
  }, []);

  const refreshNotifications = useCallback(async () => {
    setNotificationState({ loading: true, error: "" });
    try {
      const page = await submitterApi.getNotifications();
      setNotifications(page.items);
      setNotificationState({ loading: false, error: "" });
    } catch (error) {
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
