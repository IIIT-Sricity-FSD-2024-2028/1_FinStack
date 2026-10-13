import type { Resource } from "./useAsyncResource";
export function useEmployeePage<T, P>(
  loader: (params: P) => Promise<T>,
  params: P,
): Resource<T>;
