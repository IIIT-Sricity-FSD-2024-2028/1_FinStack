import { createContext } from 'react';
import type { PlatformLoginInput } from '../services/api/platform-auth';
import type { PlatformAuthState } from '../types/auth';

export interface AuthContextValue {
  auth: PlatformAuthState | null;
  initializing: boolean;
  login: (input: PlatformLoginInput) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
