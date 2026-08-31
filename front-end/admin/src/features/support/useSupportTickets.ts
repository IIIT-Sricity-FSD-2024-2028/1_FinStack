import { useCallback, useEffect, useRef, useState } from 'react';
import { getSupportTickets } from '../../services/api/platform-support';
import type {
  SupportTicketListQuery,
  SupportTicketListResponse,
} from '../../types/support';

interface SupportTicketsState {
  data: SupportTicketListResponse | null;
  error: string | null;
  loading: boolean;
}

export function useSupportTickets(query: SupportTicketListQuery) {
  const controllerRef = useRef<AbortController | null>(null);
  const [state, setState] = useState<SupportTicketsState>({
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
      const data = await getSupportTickets(query, controller.signal);
      if (!controller.signal.aborted) {
        setState({ data, error: null, loading: false });
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      setState({
        data: null,
        error:
          error instanceof Error
            ? error.message
            : 'Support tickets could not be loaded.',
        loading: false,
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
