import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getPlatformPermissions,
  getPlatformRole,
  getPlatformRolePermissions,
  getPlatformRoles,
} from '../../services/api/platform-roles';
import type {
  PlatformPermission,
  PlatformRole,
  PlatformRoleListQuery,
  PlatformRoleListResponse,
  PlatformRolePermissionAssignment,
} from '../../types/platform-role';

export function usePlatformRoleList(query: PlatformRoleListQuery) {
  const controllerRef = useRef<AbortController | null>(null);
  const [data, setData] = useState<PlatformRoleListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setError(null);
    setLoading(true);
    try {
      const result = await getPlatformRoles(query, controller.signal);
      if (!controller.signal.aborted) setData(result);
    } catch (caught) {
      if (!controller.signal.aborted) {
        setData(null);
        setError(caught instanceof Error ? caught.message : 'Roles could not be loaded.');
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    const loadTimer = window.setTimeout(() => void load(), 0);
    return () => {
      window.clearTimeout(loadTimer);
      controllerRef.current?.abort();
    };
  }, [load]);

  return { data, error, loading, reload: load };
}

interface RoleDetailState {
  role: PlatformRole | null;
  assignments: PlatformRolePermissionAssignment[];
  catalog: PlatformPermission[];
  error: string | null;
  loading: boolean;
}

export function usePlatformRoleDetail(id: string | undefined) {
  const controllerRef = useRef<AbortController | null>(null);
  const [state, setState] = useState<RoleDetailState>({
    role: null,
    assignments: [],
    catalog: [],
    error: null,
    loading: true,
  });

  const load = useCallback(async () => {
    if (!id) {
      setState({ role: null, assignments: [], catalog: [], error: 'Role id is missing.', loading: false });
      return;
    }
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setState((current) => ({ ...current, error: null, loading: true }));
    try {
      const [role, assignments, catalog] = await Promise.all([
        getPlatformRole(id, controller.signal),
        getPlatformRolePermissions(id, controller.signal),
        getPlatformPermissions('', controller.signal),
      ]);
      if (!controller.signal.aborted) {
        setState({ role, assignments, catalog, error: null, loading: false });
      }
    } catch (caught) {
      if (!controller.signal.aborted) {
        setState({
          role: null,
          assignments: [],
          catalog: [],
          error: caught instanceof Error ? caught.message : 'Role details could not be loaded.',
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
