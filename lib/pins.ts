const STORAGE_KEY = "directorRadarPins";

export function getPinnedIds(): string[] {
  if (typeof window === "undefined") {
    return [];
  }
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((item) => typeof item === "string");
    }
  } catch {
    return [];
  }
  return [];
}

export function setPinnedIds(ids: string[]): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

export function togglePinnedId(id: string): string[] {
  const current = getPinnedIds();
  if (current.includes(id)) {
    const next = current.filter((item) => item !== id);
    setPinnedIds(next);
    return next;
  }
  const next = [...current, id].slice(0, 3);
  setPinnedIds(next);
  return next;
}
