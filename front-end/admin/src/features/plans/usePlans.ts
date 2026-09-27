import { useCallback, useEffect, useRef, useState } from 'react';
import { platformCatalogApi } from '../../services/api/platform-catalog';
import { PaginatedResult, Plan, PlanStatus } from '../../types/catalog';

interface PlansState {
  data: PaginatedResult<Plan> | null;
  error: string | null;
  isLoading: boolean;
}

export function usePlans() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<PlanStatus | ''>('');
  const limit = 20;

  const controllerRef = useRef<AbortController | null>(null);
  const [state, setState] = useState<PlansState>({
    data: null,
    error: null,
    isLoading: true,
  });

  const load = useCallback(async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setState((current) => ({ ...current, error: null, isLoading: true }));

    try {
      // Pass signal if api supports it, otherwise just fetch
      const data = await platformCatalogApi.listPlans({
        page,
        limit,
        search: search || undefined,
        status: status || undefined,
      });
      if (!controller.signal.aborted) {
        setState({ data, error: null, isLoading: false });
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      setState({
        data: null,
        error: error instanceof Error ? error.message : 'Plans could not be loaded.',
        isLoading: false,
      });
    }
  }, [page, limit, search, status]);

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => {
      window.clearTimeout(loadTimer);
      controllerRef.current?.abort();
    };
  }, [load]);

  const handleSearch = (term: string) => {
    setSearch(term);
    setPage(1);
  };

  const handleStatusChange = (newStatus: PlanStatus | '') => {
    setStatus(newStatus);
    setPage(1);
  };

  return {
    ...state,
    page,
    setPage,
    search,
    handleSearch,
    status,
    handleStatusChange,
    refetch: load,
  };
}
