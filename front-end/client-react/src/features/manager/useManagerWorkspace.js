import { useCallback, useEffect, useState } from "react";
import { managerApi } from "./managerApi";
import { loadManagerWorkspace } from "./managerWorkspaceLoader.js";

export function useManagerWorkspace({ includeOfficers = false } = {}) {
  const [queue, setQueue] = useState([]);
  const [history, setHistory] = useState([]);
  const [officers, setOfficers] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    window.addEventListener("finstack:dashboard-refresh", refresh);
    return () => window.removeEventListener("finstack:dashboard-refresh", refresh);
  }, [refresh]);

  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    setError("");
    loadManagerWorkspace(managerApi, includeOfficers, controller.signal)
      .then((workspace) => {
        if (controller.signal.aborted) return;
        if (!workspace) return;
        setQueue(workspace.queue);
        setHistory(workspace.history);
        if (includeOfficers) setOfficers(workspace.officers);
        setStatus("success");
      })
      .catch((caught) => {
        if (controller.signal.aborted) return;
        setError(caught instanceof Error ? caught.message : "The Manager workspace could not be loaded.");
        setStatus("error");
      });
    return () => controller.abort();
  }, [includeOfficers, revision]);

  return { queue, history, officers, status, error, refresh };
}
