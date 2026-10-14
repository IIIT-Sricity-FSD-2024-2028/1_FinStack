import { ALLOWED_RECEIPT_MIME_TYPES } from "../receiptValidation.js";

async function receiptErrorMessage(response) {
  const payload = await response.json().catch(() => null);
  if (typeof payload?.error?.message === "string") return payload.error.message;
  if (typeof payload?.message === "string") return payload.message;
  if (response.status === 401) return "Sign in again to view this receipt.";
  if (response.status === 403) return "You do not have permission to view this receipt.";
  if (response.status === 404) return "No receipt is available for this expense.";
  return response.status >= 500
    ? "The receipt service is temporarily unavailable. Please retry."
    : "Unable to open this receipt.";
}

export async function fetchExpenseReceipt({
  id,
  baseUrl,
  accessToken,
  onUnauthorized,
  fetchImpl = fetch,
}) {
  let response;
  try {
    response = await fetchImpl(
      `${baseUrl}/api/v1/tenant/expenses/${encodeURIComponent(id)}/receipt`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      },
    );
  } catch {
    throw new Error(
      "Unable to reach the receipt service. Check your connection and retry.",
    );
  }

  if (!response.ok) {
    if (response.status === 401) onUnauthorized?.();
    const error = new Error(await receiptErrorMessage(response));
    error.status = response.status;
    throw error;
  }

  const mimeType = String(response.headers.get("content-type") || "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (!ALLOWED_RECEIPT_MIME_TYPES.has(mimeType)) {
    throw new Error("The stored receipt format cannot be displayed safely.");
  }

  const blob = await response.blob();
  return blob.type === mimeType ? blob : blob.slice(0, blob.size, mimeType);
}
