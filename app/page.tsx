"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Director } from "../lib/types";
import { fetchDirectors, isTruthy, normalizeString } from "../lib/data";
import { getPinnedIds, togglePinnedId } from "../lib/pins";

export default function HomePage() {
  const [directors, setDirectors] = useState<Director[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [tierFilter, setTierFilter] = useState("");
  const [availabilityFilter, setAvailabilityFilter] = useState("");
  const [watchlistFilter, setWatchlistFilter] = useState("");
  const [showExcluded, setShowExcluded] = useState(false);
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);

  useEffect(() => {
    fetchDirectors()
      .then((data) => {
        setDirectors(data);
        setPinnedIds(getPinnedIds());
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  const tiers = useMemo(() => {
    return Array.from(new Set(directors.map((director) => director.tier_ai).filter(Boolean))) as string[];
  }, [directors]);

  const availabilityOptions = useMemo(() => {
    return Array.from(
      new Set(directors.map((director) => director.availability_ai).filter(Boolean))
    ) as string[];
  }, [directors]);

  const watchlistOptions = useMemo(() => {
    return Array.from(
      new Set(directors.map((director) => director.watchlist_priority).filter(Boolean))
    ) as string[];
  }, [directors]);

  const filtered = useMemo(() => {
    const normalizedQuery = normalizeString(query);
    return directors.filter((director) => {
      if (!showExcluded && isTruthy(director.exclude)) {
        return false;
      }
      if (tierFilter && director.tier_ai !== tierFilter) {
        return false;
      }
      if (availabilityFilter && director.availability_ai !== availabilityFilter) {
        return false;
      }
      if (watchlistFilter && director.watchlist_priority !== watchlistFilter) {
        return false;
      }
      if (!normalizedQuery) {
        return true;
      }
      const manualNotes = Object.entries(director.manual_fields || {})
        .filter(([key]) => key.toLowerCase().includes("note"))
        .map(([, value]) => value)
        .join(" ");
      const haystack = [director.name, director.internal_notes, director.reps_manual, manualNotes]
        .filter(Boolean)
        .join(" ");
      return normalizeString(haystack).includes(normalizedQuery);
    });
  }, [availabilityFilter, directors, query, showExcluded, tierFilter, watchlistFilter]);

  const handlePin = (id: string) => {
    const next = togglePinnedId(id);
    setPinnedIds(next);
  };

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-800 bg-slate-900/40 p-6">
        <h2 className="text-lg font-semibold">Director Search</h2>
        <p className="mt-1 text-sm text-slate-400">
          Filter by tier, availability, watchlist priority, or search notes and reps.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <div className="flex flex-col gap-2">
            <label className="text-xs uppercase tracking-wide text-slate-400">Search</label>
            <input
              className="rounded-md border border-slate-700 bg-white px-3 py-2 text-sm"
              placeholder="Name, notes, reps"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs uppercase tracking-wide text-slate-400">Tier</label>
            <select
              className="rounded-md border border-slate-700 bg-white px-3 py-2 text-sm"
              value={tierFilter}
              onChange={(event) => setTierFilter(event.target.value)}
            >
              <option value="">All tiers</option>
              {tiers.map((tier) => (
                <option key={tier} value={tier}>
                  {tier}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs uppercase tracking-wide text-slate-400">Availability</label>
            <select
              className="rounded-md border border-slate-700 bg-white px-3 py-2 text-sm"
              value={availabilityFilter}
              onChange={(event) => setAvailabilityFilter(event.target.value)}
            >
              <option value="">All availability</option>
              {availabilityOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs uppercase tracking-wide text-slate-400">Watchlist</label>
            <select
              className="rounded-md border border-slate-700 bg-white px-3 py-2 text-sm"
              value={watchlistFilter}
              onChange={(event) => setWatchlistFilter(event.target.value)}
            >
              <option value="">All priorities</option>
              {watchlistOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={showExcluded}
                onChange={(event) => setShowExcluded(event.target.checked)}
              />
              Show excluded
            </label>
            <Link href="/compare" className="text-sm text-sky-300">
              Compare ({pinnedIds.length})
            </Link>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Directors ({filtered.length})</h3>
          {error && <span className="text-sm text-rose-400">{error}</span>}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((director) => {
            const isPinned = pinnedIds.includes(director.id);
            return (
              <div
                key={director.id}
                className="rounded-lg border border-slate-800 bg-slate-900/40 p-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <Link href={`/directors/${encodeURIComponent(director.id)}`} className="text-lg">
                      {director.name}
                    </Link>
                    <p className="text-xs text-slate-400">{director.id}</p>
                  </div>
                  <button
                    type="button"
                    className={`rounded-md border px-2 py-1 text-xs ${
                      isPinned
                        ? "border-emerald-400 bg-emerald-500/20 text-emerald-200"
                        : "border-slate-700 text-slate-300"
                    }`}
                    onClick={() => handlePin(director.id)}
                  >
                    {isPinned ? "Pinned" : "Pin"}
                  </button>
                </div>
                <div className="mt-3 grid gap-2 text-sm text-slate-300">
                  <div>
                    <span className="text-slate-400">Tier:</span> {director.tier_ai || "—"}
                  </div>
                  <div>
                    <span className="text-slate-400">Availability:</span> {director.availability_ai || "—"}
                  </div>
                  <div>
                    <span className="text-slate-400">Watchlist:</span> {director.watchlist_priority || "—"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
