export async function loadManagerWorkspace(api, includeOfficers, signal) {
  const [queue, history, officers] = await Promise.all([
    api.queue(signal),
    api.history(signal),
    ...(includeOfficers ? [api.financeOfficers(signal)] : []),
  ]);
  if (signal.aborted) return null;
  return {
    queue: Array.isArray(queue) ? queue : [],
    history: Array.isArray(history) ? history : [],
    officers: includeOfficers && Array.isArray(officers) ? officers : [],
  };
}
