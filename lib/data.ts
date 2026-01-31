import type { Director } from "./types";

export async function fetchDirectors(): Promise<Director[]> {
  const response = await fetch("/data/atlas/directors.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Failed to load directors.json");
  }
  return (await response.json()) as Director[];
}

export function normalizeString(value?: string): string {
  return (value || "").toLowerCase();
}

export function isTruthy(value?: string): boolean {
  if (!value) return false;
  return ["true", "1", "yes", "y"].includes(value.toLowerCase().trim());
}

export function parseEvidenceUrls(value?: string): string[] {
  if (!value) return [];
  return value
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}
