import { type PropsWithChildren, useCallback, useEffect, useMemo, useState } from 'react';
import { configureAuthRecovery } from '../services/api/client';
import {
  loginPlatform,
  logoutPlatform,
  refreshPlatformSession,
} from '../services/api/platform-auth';
import {
  clearAccessToken,
  setAccessToken,
} from '../services/auth/session';
import type { PlatformAuthPayload, PlatformAuthState } from '../types/auth';
import { AuthContext, type AuthContextValue } from './auth-context';

export function AuthProvider({ children }: PropsWithChildren) {
  const [auth, setAuth] = useState<PlatformAuthState | null>(null);
  const [initializing, setInitializing] = useState(true);

  const acceptPayload = useCallback((payload: PlatformAuthPayload) => {
    setAccessToken(payload.accessToken);
    setAuth({
      sessionId: payload.sessionId,
      staff: payload.staff,
      roles: payload.roles,
      permissions: payload.permissions,
    });
    return payload.accessToken;
  }, []);

  const clearAuth = useCallback(() => {
    clearAccessToken();
    setAuth(null);
  }, []);

  const refresh = useCallback(async () => {
    const payload = await refreshPlatformSession();
    return acceptPayload(payload);
  }, [acceptPayload]);

  useEffect(() => {
    configureAuthRecovery({ refresh, failed: clearAuth });
    const restoreTimer = window.setTimeout(() => {
      void refresh()
        .catch(clearAuth)
        .finally(() => setInitializing(false));
    }, 0);
    return () => {
      window.clearTimeout(restoreTimer);
      configureAuthRecovery(null);
    };
  }, [clearAuth, refresh]);

  const value = useMemo<AuthContextValue>(
    () => ({
      auth,
      initializing,
      login: async (input) => {
        acceptPayload(await loginPlatform(input));
      },
      logout: async () => {
        try {
          await logoutPlatform();
        } finally {
          clearAuth();
        }
      },
      hasPermission: (permission) =>
        auth?.permissions.includes(permission) ?? false,
    }),
    [acceptPayload, auth, clearAuth, initializing],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
