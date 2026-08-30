import { useCallback, useEffect, useRef, useState } from "react";
import { getAuditLogs } from "../../services/api/platform-audit";
import type {
  AuditLogListQuery,
  AuditLogListResponse,
} from "../../types/platform-audit";

interface AuditLogsState {
  data: AuditLogListResponse | null;
  error: string | null;
  loading: boolean;
}

export function useAuditLogs(query: AuditLogListQuery) {
  const controllerRef = useRef<AbortController | null>(null);
  const [state, setState] = useState<AuditLogsState>({
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
      const data = await getAuditLogs(query, controller.signal);
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
            : "Audit logs could not be loaded.",
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
