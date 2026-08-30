import { useCallback, useEffect, useState } from 'react';
import { platformCatalogApi } from '../../services/api/platform-catalog';
import { Plan } from '../../types/catalog';

interface PlanState {
  data: Plan | null;
  error: string | null;
  isLoading: boolean;
}

export function usePlan(id: string) {
  const [state, setState] = useState<PlanState>({
    data: null,
    error: null,
    isLoading: true,
  });

  const [isActivating, setIsActivating] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [isUpdatingFeature, setIsUpdatingFeature] = useState(false);
  const [isRemovingFeature, setIsRemovingFeature] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!id) return;
    if (!silent) {
      setState((current) => ({ ...current, error: null, isLoading: true }));
    }
    try {
      const data = await platformCatalogApi.getPlan(id);
      setState((current) => ({ ...current, data, error: null, isLoading: false }));
    } catch (error) {
      setState((current) => ({
        ...current,
        data: null,
        error: error instanceof Error ? error.message : 'Plan could not be loaded.',
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

  const activatePlan = async () => {
    setIsActivating(true);
    try {
      await platformCatalogApi.activatePlan(id);
      await load(true);
    } finally {
      setIsActivating(false);
    }
  };

  const deactivatePlan = async () => {
    setIsDeactivating(true);
    try {
      await platformCatalogApi.deactivatePlan(id);
      await load(true);
    } finally {
      setIsDeactivating(false);
    }
  };

  const assignFeature = async (data: { featureId: string; enabled?: boolean; value?: unknown }) => {
    setIsAssigning(true);
    try {
      await platformCatalogApi.assignFeature(id, data);
      await load(true);
    } finally {
      setIsAssigning(false);
    }
  };

  const updateFeature = async (data: { featureId: string; payload: { enabled?: boolean; value?: unknown } }) => {
    setIsUpdatingFeature(true);
    try {
      await platformCatalogApi.updatePlanFeature(id, data.featureId, data.payload);
      await load(true);
    } finally {
      setIsUpdatingFeature(false);
    }
  };

  const removeFeature = async (featureId: string) => {
    setIsRemovingFeature(true);
    try {
      await platformCatalogApi.removePlanFeature(id, featureId);
      await load(true);
    } finally {
      setIsRemovingFeature(false);
    }
  };

  return {
    ...state,
    refetch: load,
    activatePlan,
    isActivating,
    deactivatePlan,
    isDeactivating,
    assignFeature,
    isAssigning,
    updateFeature,
    isUpdatingFeature,
    removeFeature,
    isRemovingFeature,
  };
}
