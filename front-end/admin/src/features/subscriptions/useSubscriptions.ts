import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../../services/api/client';
import {
  getPlatformSubscription,
  getPlatformSubscriptions,
} from '../../services/api/platform-subscriptions';
import type {
  OrganizationSubscription,
  PaginatedSubscriptionsResponse,
  SubscriptionListQuery,
} from '../../types/subscriptions';

interface SubscriptionListState {
  data: PaginatedSubscriptionsResponse | null;
  error: string | null;
  loading: boolean;
}

interface SubscriptionDetailState {
  data: OrganizationSubscription | null;
  error: string | null;
  loading: boolean;
  notFound: boolean;
}

export function useSubscriptions(query: SubscriptionListQuery) {
  const controllerRef = useRef<AbortController | null>(null);
  const [state, setState] = useState<SubscriptionListState>({
    data: null,
    error: null,
    loading: true,
  });

  const load = useCallback(async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setState((current) => ({ ...current, error: null, loading: true }));

    try {
      const data = await getPlatformSubscriptions(query, controller.signal);
      if (!controller.signal.aborted) {
        setState({ data, error: null, loading: false });
      }
    } catch (caught) {
      if (controller.signal.aborted) return;
      setState({
        data: null,
        error:
          caught instanceof Error
            ? caught.message
            : 'Subscriptions could not be loaded.',
        loading: false,
      });
    }
  }, [query]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => {
      window.clearTimeout(timer);
      controllerRef.current?.abort();
    };
  }, [load]);

  return { ...state, reload: load };
}

export function useSubscription(subscriptionId: string | undefined) {
  const controllerRef = useRef<AbortController | null>(null);
  const [state, setState] = useState<SubscriptionDetailState>({
    data: null,
    error: null,
    loading: true,
    notFound: false,
  });

  const load = useCallback(async () => {
    if (!subscriptionId) {
      setState({
        data: null,
        error: 'Subscription ID is required.',
        loading: false,
        notFound: true,
      });
      return;
    }

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setState((current) => ({
      ...current,
      error: null,
      loading: true,
      notFound: false,
    }));

    try {
      const data = await getPlatformSubscription(subscriptionId, controller.signal);
      if (!controller.signal.aborted) {
        setState({ data, error: null, loading: false, notFound: false });
      }
    } catch (caught) {
      if (controller.signal.aborted) return;
      const notFound = caught instanceof ApiError && caught.status === 404;
      setState({
        data: null,
        error: notFound
          ? 'Subscription not found.'
          : caught instanceof Error
            ? caught.message
            : 'Subscription could not be loaded.',
        loading: false,
        notFound,
      });
    }
  }, [subscriptionId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => {
      window.clearTimeout(timer);
      controllerRef.current?.abort();
    };
  }, [load]);

  return { ...state, reload: load };
}
