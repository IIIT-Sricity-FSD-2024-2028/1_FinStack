export function filterCategories(categories, search, status) {
  const query = String(search || "")
    .trim()
    .toLocaleLowerCase();
  return categories.filter(
    (category) =>
      (!query ||
        category.name.toLocaleLowerCase().includes(query) ||
        String(category.description || "")
          .toLocaleLowerCase()
          .includes(query)) &&
      (status === "all" || category.status === status),
  );
}

export function paginateCategories(items, page, pageSize = 10) {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(Math.max(1, page), pageCount);
  return {
    page: currentPage,
    pageCount,
    items: items.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    total: items.length,
  };
}

export function categoryActivationSummary(response, selectedCount) {
  const createdCount = Number(response.createdCount || 0);
  const existingCount = Number(response.existingCount || 0);
  const skippedNames = (response.skippedTemplates || []).map(
    (item) => `${item.name}${item.status === "Inactive" ? " (inactive)" : ""}`,
  );
  if (createdCount === 0) {
    return `No new categories were added. ${existingCount} already existed and were left unchanged${skippedNames.length ? `: ${skippedNames.join(", ")}` : ""}.`;
  }
  return `Activated ${createdCount} of ${selectedCount} selected categories.${existingCount ? ` ${existingCount} already existed and were left unchanged${skippedNames.length ? `: ${skippedNames.join(", ")}` : ""}.` : ""}`;
}
