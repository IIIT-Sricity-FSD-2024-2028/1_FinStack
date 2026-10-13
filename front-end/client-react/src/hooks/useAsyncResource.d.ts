export type Resource<T> = (
  | { status: "loading"; data: T | null; error: null }
  | { status: "success"; data: T; error: null }
  | { status: "error"; data: null; error: Error }
) & { refresh: () => Promise<T | undefined> };
export function useAsyncResource<T>(loader: () => Promise<T>): Resource<T>;
