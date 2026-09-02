import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getPlatformStaff,
  getPlatformStaffMember,
  getPlatformStaffRoles,
} from '../../services/api/platform-staff';
import type {
  PlatformStaff,
  PlatformStaffListQuery,
  PlatformStaffListResponse,
  PlatformStaffRoleAssignment,
} from '../../types/platform-staff';

interface ListState {
  data: PlatformStaffListResponse | null;
  error: string | null;
  loading: boolean;
}

export function usePlatformStaffList(query: PlatformStaffListQuery) {
  const controllerRef = useRef<AbortController | null>(null);
  const [state, setState] = useState<ListState>({
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
      const data = await getPlatformStaff(query, controller.signal);
      if (!controller.signal.aborted) {
        setState({ data, error: null, loading: false });
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        setState({
          data: null,
          error:
            error instanceof Error ? error.message : 'Staff could not be loaded.',
          loading: false,
        });
      }
    }
  }, [query]);

  useEffect(() => {
    const loadTimer = window.setTimeout(() => void load(), 0);
    return () => {
      window.clearTimeout(loadTimer);
      controllerRef.current?.abort();
    };
  }, [load]);

  return { ...state, reload: load };
}

interface DetailState {
  staff: PlatformStaff | null;
  roles: PlatformStaffRoleAssignment[];
  error: string | null;
  loading: boolean;
}

export function usePlatformStaffDetail(id: string | undefined) {
  const controllerRef = useRef<AbortController | null>(null);
  const [state, setState] = useState<DetailState>({
    staff: null,
    roles: [],
    error: null,
    loading: true,
  });

  const load = useCallback(async () => {
    if (!id) {
      setState({
        staff: null,
        roles: [],
        error: 'Staff id is missing.',
        loading: false,
      });
      return;
    }
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setState((current) => ({ ...current, error: null, loading: true }));
    try {
      const [staff, roles] = await Promise.all([
        getPlatformStaffMember(id, controller.signal),
        getPlatformStaffRoles(id, controller.signal),
      ]);
      if (!controller.signal.aborted) {
        setState({ staff, roles, error: null, loading: false });
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        setState({
          staff: null,
          roles: [],
          error:
            error instanceof Error
              ? error.message
              : 'Staff details could not be loaded.',
          loading: false,
        });
      }
    }
  }, [id]);

  useEffect(() => {
    const loadTimer = window.setTimeout(() => void load(), 0);
    return () => {
      window.clearTimeout(loadTimer);
      controllerRef.current?.abort();
    };
  }, [load]);

  return { ...state, reload: load };
}
