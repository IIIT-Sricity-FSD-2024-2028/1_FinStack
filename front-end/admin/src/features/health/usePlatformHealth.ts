import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getPlatformHealth,
  type PlatformHealth,
} from '../../services/api/platform-health';

interface HealthState {
  data: PlatformHealth | null;
  error: string | null;
  loading: boolean;
}

export function usePlatformHealth() {
  const controllerRef = useRef<AbortController | null>(null);
  const [state, setState] = useState<HealthState>({
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
      const data = await getPlatformHealth(controller.signal);
      setState({ data, error: null, loading: false });
    } catch (error) {
      if (controller.signal.aborted) return;
      setState({
        data: null,
        error:
          error instanceof Error
            ? error.message
            : 'The health check could not be completed.',
        loading: false,
      });
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    controllerRef.current = controller;

    void getPlatformHealth(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setState({ data, error: null, loading: false });
        }
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          data: null,
          error:
            error instanceof Error
              ? error.message
              : 'The health check could not be completed.',
          loading: false,
        });
      });

    return () => controller.abort();
  }, []);

  return { ...state, reload: load };
}
