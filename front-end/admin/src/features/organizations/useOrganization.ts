import { useCallback, useEffect, useRef, useState } from 'react';
import { getOrganization } from '../../services/api/platform-organizations';
import type { Organization } from '../../types/organization';

interface OrganizationState {
  data: Organization | null;
  error: string | null;
  loading: boolean;
}

export function useOrganization(id: string | undefined) {
  const controllerRef = useRef<AbortController | null>(null);
  const [state, setState] = useState<OrganizationState>({
    data: null,
    error: null,
    loading: true,
  });

  const load = useCallback(async () => {
    if (!id) {
      setState({
        data: null,
        error: 'Organization id is missing.',
        loading: false,
      });
      return;
    }
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setState((current) => ({ ...current, error: null, loading: true }));

    try {
      const data = await getOrganization(id, controller.signal);
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
            : 'Organization details could not be loaded.',
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
