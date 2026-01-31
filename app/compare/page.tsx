"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Director } from "../../lib/types";
import { fetchDirectors } from "../../lib/data";
import { getPinnedIds, togglePinnedId } from "../../lib/pins";

export default function ComparePage() {
  const [directors, setDirectors] = useState<Director[]>([]);
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDirectors()
      .then((data) => {
        setDirectors(data);
        setPinnedIds(getPinnedIds());
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  const pinnedDirectors = useMemo(() => {
    return pinnedIds
      .map((id) => directors.find((director) => director.id === id))
      .filter((director): director is Director => Boolean(director));
  }, [directors, pinnedIds]);

  const handleUnpin = (id: string) => {
    const next = togglePinnedId(id);
    setPinnedIds(next);
  };

  if (error) {
    return (
      <div className="space-y-4">
        <p className="text-rose-400">{error}</p>
        <Link href="/" className="text-sm">
          Back to search
        </Link>
      </div>
    );
  }

  if (pinnedDirectors.length === 0) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Compare Directors</h2>
        <p className="text-slate-400">No pinned directors yet. Pin up to three to compare.</p>
        <Link href="/" className="text-sm">
          Back to search
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Compare Directors</h2>
        <Link href="/" className="text-sm text-slate-300">
          Back to search
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {pinnedDirectors.map((director) => (
          <div key={director.id} className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
            <div className="flex items-start justify-between">
              <div>
                <Link href={`/directors/${encodeURIComponent(director.id)}`} className="text-lg">
                  {director.name}
                </Link>
                <p className="text-xs text-slate-400">{director.id}</p>
              </div>
              <button
                type="button"
                className="text-xs text-rose-300"
                onClick={() => handleUnpin(director.id)}
              >
                Unpin
              </button>
            </div>
            <div className="mt-4 space-y-2 text-sm">
              <div>
                <span className="text-slate-400">Tier:</span> {director.tier_ai || "—"}
              </div>
              <div>
                <span className="text-slate-400">Availability:</span> {director.availability_ai || "—"}
              </div>
              <div>
                <span className="text-slate-400">Watchlist:</span> {director.watchlist_priority || "—"}
              </div>
              <div>
                <span className="text-slate-400">Reps:</span> {director.reps_manual || "—"}
              </div>
              <div>
                <span className="text-slate-400">Notes:</span> {director.internal_notes || "—"}
              </div>
            </div>
            <div className="mt-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">Spreadsheet highlights</p>
              <ul className="mt-2 space-y-1 text-xs text-slate-300">
                {Object.entries(director.manual_fields || {})
                  .slice(0, 5)
                  .map(([key, value]) => (
                    <li key={key}>
                      <span className="text-slate-400">{key}:</span> {value || "—"}
                    </li>
                  ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
