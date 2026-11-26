import type { Resource } from '../../hooks/useAsyncResource';
import type { configManagerResources } from '../../adapters/configManagerResources.js';
export function useConfigResource<T = any>(name: string, args?: unknown, options?: { skip?: boolean }): Resource<T>;
export function useConfigCommands(): {
  query: <T = any>(name: string, args?: unknown, forceRefetch?: boolean, signal?: AbortSignal) => Promise<T>;
  mutate: <T = any>(name: string, args?: unknown) => Promise<T>;
  users: Pick<typeof configManagerResources.users, 'create' | 'update' | 'updateStatus'>;
  hierarchy: Pick<typeof configManagerResources.hierarchy, 'updateManager'>;
  categories: Pick<typeof configManagerResources.categories, 'create' | 'update' | 'delete'>;
  policies: Pick<typeof configManagerResources.policies, 'create' | 'update' | 'delete'>;
  templates: Pick<typeof configManagerResources.templates, 'activateCategories' | 'activatePolicies'>;
};
export function asError(error: unknown): Error;
