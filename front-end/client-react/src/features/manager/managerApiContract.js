const EXPENSES = "/api/v1/tenant/expenses";

export function createManagerApi(request, requestBlob) {
  return {
    queue: (signal) => request(`${EXPENSES}/manager/queue`, { signal }),
    history: (signal) => request(`${EXPENSES}/manager/history`, { signal }),
    financeOfficers: (signal) => request(`${EXPENSES}/manager/finance-officers`, { signal }),
    approve: (id, body) => request(`${EXPENSES}/${encodeURIComponent(id)}/manager/approve`, { method: "POST", body }),
    returnForCorrection: (id, note) => request(`${EXPENSES}/${encodeURIComponent(id)}/manager/return`, { method: "POST", body: { note } }),
    reject: (id, note) => request(`${EXPENSES}/${encodeURIComponent(id)}/manager/reject`, { method: "POST", body: { note } }),
    escalate: (id, note) => request(`${EXPENSES}/${encodeURIComponent(id)}/manager/escalate`, { method: "POST", body: { note } }),
    notifications: (signal) => request(`${EXPENSES}/notifications`, { signal }),
    markNotificationRead: (id) => request(`${EXPENSES}/notifications/${encodeURIComponent(id)}/read`, { method: "PATCH", body: {} }),
    markAllNotificationsRead: () => request(`${EXPENSES}/notifications/read-all`, { method: "POST", body: {} }),
    dismissNotification: (id) => request(`${EXPENSES}/notifications/${encodeURIComponent(id)}`, { method: "DELETE" }),
    receipt: (id) => requestBlob(`${EXPENSES}/${encodeURIComponent(id)}/receipt`),
  };
}
