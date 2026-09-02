import { useCallback, useEffect, useRef, useState } from "react";
import {
  getNotifications,
  getUnreadNotificationCount,
} from "../../services/api/platform-notifications";
import type {
  PlatformNotificationListQuery,
  PlatformNotificationListResponse,
} from "../../types/platform-notification";

interface NotificationsState {
  data: PlatformNotificationListResponse | null;
  error: string | null;
  loading: boolean;
  unreadCount: number;
}

export function useNotifications(query: PlatformNotificationListQuery) {
  const controllerRef = useRef<AbortController | null>(null);
  const [state, setState] = useState<NotificationsState>({
    data: null,
    error: null,
    loading: true,
    unreadCount: 0,
  });

  const load = useCallback(async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setState((current) => ({ ...current, error: null, loading: true }));

    try {
      const [notifications, unread] = await Promise.all([
        getNotifications(query, controller.signal),
        getUnreadNotificationCount(controller.signal),
      ]);
      if (!controller.signal.aborted) {
        setState({
          data: notifications,
          error: null,
          loading: false,
          unreadCount: unread.unreadCount,
        });
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      setState({
        data: null,
        error:
          error instanceof Error
            ? error.message
            : "Notifications could not be loaded.",
        loading: false,
        unreadCount: 0,
      });
    }
  }, [query]);

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => {
      window.clearTimeout(loadTimer);
      controllerRef.current?.abort();
    };
  }, [load]);

  return { ...state, reload: load };
}
