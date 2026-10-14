export function buildExpenseTrend(expenses) {
  return expenses
    .map((expense, index) => {
      const expenseDate = new Date(expense.date);
      const validDate = !Number.isNaN(expenseDate.valueOf());

      return {
        id: expense.id || `expense-${index}`,
        label: validDate
          ? expenseDate.toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
            })
          : "Unknown",
        value: Number(expense.amount || 0),
        stamp: validDate ? expenseDate.valueOf() : Number.POSITIVE_INFINITY,
        index,
      };
    })
    .sort(
      (first, second) =>
        first.stamp - second.stamp || first.index - second.index,
    );
}
