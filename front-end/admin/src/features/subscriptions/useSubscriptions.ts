import { useCallback, useEffect, useRef, useState } from 'react';
import { platformSubscriptionsApi } from '../../services/api/platform-subscriptions';
import type {
  PaginatedCommercialResult,
  Subscription,
  SubscriptionHistory,
} from '../../types/commercial';

interface ListState {
  data: PaginatedCommercialResult<Subscription> | null;
  error: string | null;
  loading: boolean;
}

export function useSubscriptions(query: {
  page: number;
  pageSize: number;
  search: string;
  status: string;
  sortBy: string;
  order: 'asc' | 'desc';
}) {
  const [state, setState] = useState<ListState>({ data: null, error: null, loading: true });
  const controllerRef = useRef<AbortController | null>(null);

  const reload = useCallback(async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const data = await platformSubscriptionsApi.list(query);
      if (!controller.signal.aborted) setState({ data, error: null, loading: false });
    } catch (caught) {
      if (!controller.signal.aborted) {
        setState({ data: null, error: caught instanceof Error ? caught.message : 'Subscriptions could not be loaded.', loading: false });
      }
    }
  }, [query]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void reload(); }, 0);
    return () => {
      window.clearTimeout(timer);
      controllerRef.current?.abort();
    };
  }, [reload]);

  return { ...state, reload };
}

interface DetailState {
  data: Subscription | null;
  history: PaginatedCommercialResult<SubscriptionHistory> | null;
  error: string | null;
  loading: boolean;
}

export function useSubscription(id: string | undefined) {
  const [state, setState] = useState<DetailState>({ data: null, history: null, error: null, loading: true });
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!id) {
      setState({ data: null, history: null, error: 'Subscription id is missing.', loading: false });
      return;
    }
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const [data, history] = await Promise.all([
        platformSubscriptionsApi.get(id),
        platformSubscriptionsApi.history(id, { page: 1, pageSize: 50 }),
      ]);
      setState({ data, history, error: null, loading: false });
    } catch (caught) {
      setState((current) => ({ ...current, error: caught instanceof Error ? caught.message : 'Subscription could not be loaded.', loading: false }));
    }
  }, [id]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void reload(); }, 0);
    return () => window.clearTimeout(timer);
  }, [reload]);

  async function runAction(key: string, action: () => Promise<unknown>) {
    setPendingAction(key);
    try {
      await action();
      await reload();
    } finally {
      setPendingAction(null);
    }
  }

  return { ...state, reload, pendingAction, runAction };
}
