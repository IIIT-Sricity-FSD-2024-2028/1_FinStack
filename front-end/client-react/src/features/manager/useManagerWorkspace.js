import { useEffect, useRef, useState } from "react";
import { useLiveRefresh } from "../../hooks/useLiveRefresh";
import { managerApi } from "./managerApi";
import { loadManagerWorkspace } from "./managerWorkspaceLoader.js";

export function useManagerWorkspace({ includeOfficers = false } = {}) {
  const [queue, setQueue] = useState([]);
  const [history, setHistory] = useState([]);
  const [officers, setOfficers] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const activeRequest = useRef(null);

  useEffect(() => () => activeRequest.current?.abort(), []);

  async function loadWorkspace({ background = false } = {}) {
    const controller = new AbortController();
    activeRequest.current = controller;
    if (!background) {
      setStatus("loading");
      setError("");
    }
    try {
      const workspace = await loadManagerWorkspace(managerApi, includeOfficers, controller.signal);
      if (controller.signal.aborted || !workspace) return;
      setQueue(workspace.queue);
      setHistory(workspace.history);
      if (includeOfficers) setOfficers(workspace.officers);
      setStatus("success");
      setError("");
    } catch (caught) {
      if (controller.signal.aborted) return;
      if (background) throw caught;
      setError(caught instanceof Error ? caught.message : "The Manager workspace could not be loaded.");
      setStatus("error");
    } finally {
      if (activeRequest.current === controller) activeRequest.current = null;
    }
  }

  // Live changes refresh in the background, preserving filters and the current route.
  const { refreshNow, retryNow, refreshError } = useLiveRefresh(loadWorkspace);
  useEffect(() => {
    window.addEventListener("finstack:dashboard-refresh", refreshNow);
    return () => window.removeEventListener("finstack:dashboard-refresh", refreshNow);
  }, [refreshNow]);

  return { queue, history, officers, status, error, refresh: retryNow, refreshError };
}
