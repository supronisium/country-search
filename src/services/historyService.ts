const STORAGE_KEY = "country-search-history";
const MAX_HISTORY_ITEMS = 7;

export function getSearchHistory(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string").slice(0, MAX_HISTORY_ITEMS)
      : [];
  } catch {
    return [];
  }
}

export function saveSearchQuery(query: string): void {
  const normalized = query.trim();
  if (!normalized) return;

  const next = [
    normalized,
    ...getSearchHistory().filter((item) => item.toLocaleLowerCase() !== normalized.toLocaleLowerCase())
  ].slice(0, MAX_HISTORY_ITEMS);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Недоступное хранилище не должно ломать поиск.
  }
}
