import { useCallback, useEffect, useRef, useState } from "react";
import { LIVE_REFRESH_EVENT } from "./liveRefreshController.js";

export function useAsyncResource(loader) {
  const [state, setState] = useState({
    status: "loading",
    data: null,
    error: null,
  });
  const generation = useRef(0);

  const load = useCallback(async ({ background = false } = {}) => {
    const sequence = ++generation.current;
    if (!background)
      setState((current) => ({ ...current, status: "loading", error: null }));
    try {
      const data = await loader();
      if (sequence !== generation.current) return undefined;
      setState({ status: "success", data, error: null });
      return data;
    } catch (error) {
      if (sequence !== generation.current) return undefined;
      if (!background) setState({ status: "error", data: null, error });
      throw error;
    }
  }, [loader]);

  useEffect(() => {
    load().catch(() => undefined);
    return () => {
      generation.current++;
    };
  }, [load]);

  useEffect(() => {
    const onChanged = () => load({ background: true }).catch(() => undefined);
    window.addEventListener(LIVE_REFRESH_EVENT, onChanged);
    return () => window.removeEventListener(LIVE_REFRESH_EVENT, onChanged);
  }, [load]);

  const refresh = useCallback(() => load().catch(() => undefined), [load]);
  return { ...state, refresh };
}
