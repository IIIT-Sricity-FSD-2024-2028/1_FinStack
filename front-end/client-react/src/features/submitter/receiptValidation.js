export const MAX_RECEIPT_SIZE = 5 * 1024 * 1024;

const ALLOWED_RECEIPT_EXTENSIONS = new Set(["jpg", "jpeg", "png", "pdf"]);
export const ALLOWED_RECEIPT_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "application/pdf",
]);

export function validateReceipt(file, { required = false } = {}) {
  if (!file) return required ? "Receipt upload is required." : "";

  const extension = String(file.name || "").split(".").pop().toLowerCase();
  if (!ALLOWED_RECEIPT_EXTENSIONS.has(extension)) {
    return "Choose a JPEG, PNG, or PDF receipt.";
  }
  if (!ALLOWED_RECEIPT_MIME_TYPES.has(String(file.type || "").toLowerCase())) {
    return "The selected receipt type is not supported.";
  }
  if (!Number.isFinite(file.size) || file.size < 0 || file.size > MAX_RECEIPT_SIZE) {
    return "Receipt must be 5 MB or smaller.";
  }
  return "";
}
