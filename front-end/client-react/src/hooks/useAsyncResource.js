import { useCallback, useEffect, useRef, useState } from "react";

export function useAsyncResource(loader) {
  const [state, setState] = useState({
    status: "loading",
    data: null,
    error: null,
  });
  const generation = useRef(0);

  const load = useCallback(async () => {
    const sequence = ++generation.current;
    setState((current) => ({ ...current, status: "loading", error: null }));
    try {
      const data = await loader();
      if (sequence !== generation.current) return undefined;
      setState({ status: "success", data, error: null });
      return data;
    } catch (error) {
      if (sequence !== generation.current) return undefined;
      setState({ status: "error", data: null, error });
      throw error;
    }
  }, [loader]);

  useEffect(() => {
    load().catch(() => undefined);
    return () => {
      generation.current++;
    };
  }, [load]);

  const refresh = useCallback(() => load().catch(() => undefined), [load]);
  return { ...state, refresh };
}
