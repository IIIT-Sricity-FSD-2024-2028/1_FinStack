import { useCallback, useEffect, useRef, useState } from 'react';
import { platformCatalogApi } from '../../services/api/platform-catalog';
import { Feature, PaginatedResult } from '../../types/catalog';

interface FeaturesState {
  data: PaginatedResult<Feature> | null;
  error: string | null;
  isLoading: boolean;
}

export function useFeatures() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [isActive, setIsActive] = useState<string>(''); // '' | 'true' | 'false'
  const limit = 20;

  const controllerRef = useRef<AbortController | null>(null);
  const [state, setState] = useState<FeaturesState>({
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
      const data = await platformCatalogApi.listFeatures({
        page,
        limit,
        search: search || undefined,
        isActive: isActive === '' ? undefined : isActive === 'true',
      });
      if (!controller.signal.aborted) {
        setState({ data, error: null, isLoading: false });
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      setState({
        data: null,
        error: error instanceof Error ? error.message : 'Features could not be loaded.',
        isLoading: false,
      });
    }
  }, [page, limit, search, isActive]);

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

  const handleStatusChange = (status: string) => {
    setIsActive(status);
    setPage(1);
  };

  return {
    ...state,
    page,
    setPage,
    search,
    handleSearch,
    isActive,
    handleStatusChange,
    refetch: load,
  };
}
