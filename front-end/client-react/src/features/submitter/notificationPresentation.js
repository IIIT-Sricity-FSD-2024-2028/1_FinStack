const uuidPattern = "[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}";
const uuid = new RegExp(`\\b${uuidPattern}\\b`, "gi");
const expenseReference = new RegExp(`\\b(?:your\\s+)?expense\\s+${uuidPattern}\\b`, "gi");

export function notificationText(text, expense, fallback = "There is an update to your expense.") {
  // Derive display text only. API action IDs and the original message stay intact.
  const merchant = String(expense?.merchant || "").replace(uuid, "").trim();
  const reference = merchant ? `your expense at ${merchant}` : "your expense";
  return String(text || "").trim()
    .replace(expenseReference, reference)
    .replace(uuid, reference)
    .replace(/^your expense/, "Your expense") || fallback;
}
