import { useCallback, useEffect, useRef, useState } from 'react';
import { getSupportTicket } from '../../services/api/platform-support';
import type { SupportTicketDetail } from '../../types/support';

interface SupportTicketState {
  data: SupportTicketDetail | null;
  error: string | null;
  loading: boolean;
}

export function useSupportTicket(id: string | undefined) {
  const controllerRef = useRef<AbortController | null>(null);
  const [state, setState] = useState<SupportTicketState>({
    data: null,
    error: null,
    loading: Boolean(id),
  });

  const load = useCallback(async () => {
    if (!id) {
      setState({
        data: null,
        error: 'Support ticket id is missing.',
        loading: false,
      });
      return;
    }

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setState((current) => ({ ...current, error: null, loading: true }));

    try {
      const data = await getSupportTicket(id, controller.signal);
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
            : 'Support ticket could not be loaded.',
        loading: false,
      });
    }
  }, [id]);

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
