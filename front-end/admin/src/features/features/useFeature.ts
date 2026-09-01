import { useCallback, useEffect, useState } from 'react';
import { platformCatalogApi } from '../../services/api/platform-catalog';
import { Feature } from '../../types/catalog';

interface FeatureState {
  data: Feature | null;
  error: string | null;
  isLoading: boolean;
}

export function useFeature(id: string) {
  const [state, setState] = useState<FeatureState>({
    data: null,
    error: null,
    isLoading: true,
  });

  const [isActivating, setIsActivating] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!id) return;
    if (!silent) {
      setState((current) => ({ ...current, error: null, isLoading: true }));
    }
    try {
      const data = await platformCatalogApi.getFeature(id);
      setState((current) => ({ ...current, data, error: null, isLoading: false }));
    } catch (error) {
      setState((current) => ({
        ...current,
        data: null,
        error: error instanceof Error ? error.message : 'Feature could not be loaded.',
        isLoading: false,
      }));
    }
  }, [id]);

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => {
      window.clearTimeout(loadTimer);
    };
  }, [load]);

  const activateFeature = async () => {
    setIsActivating(true);
    try {
      await platformCatalogApi.activateFeature(id);
      await load(true);
    } finally {
      setIsActivating(false);
    }
  };

  const deactivateFeature = async () => {
    setIsDeactivating(true);
    try {
      await platformCatalogApi.deactivateFeature(id);
      await load(true);
    } finally {
      setIsDeactivating(false);
    }
  };

  return {
    ...state,
    refetch: load,
    activateFeature,
    isActivating,
    deactivateFeature,
    isDeactivating,
  };
}
