"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { Director } from "../../../lib/types";
import { fetchDirectors, parseEvidenceUrls } from "../../../lib/data";
import { getPinnedIds, togglePinnedId } from "../../../lib/pins";

export default function DirectorDetailPage() {
  const params = useParams();
  const directorId = decodeURIComponent(params?.id as string);
  const [director, setDirector] = useState<Director | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);

  useEffect(() => {
    fetchDirectors()
      .then((data) => {
        const found = data.find((item) => item.id === directorId);
        if (!found) {
          setError("Director not found.");
          return;
        }
        setDirector(found);
        setPinnedIds(getPinnedIds());
      })
      .catch((err: Error) => setError(err.message));
  }, [directorId]);

  const handlePin = () => {
    const next = togglePinnedId(directorId);
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

  if (!director) {
    return <p className="text-slate-400">Loading director...</p>;
  }

  const evidenceUrls = parseEvidenceUrls(director.ai_evidence_urls);
  const isPinned = pinnedIds.includes(directorId);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/" className="text-sm text-slate-400">
            ← Back to search
          </Link>
          <h2 className="mt-2 text-2xl font-semibold">{director.name}</h2>
          <p className="text-xs text-slate-400">{director.id}</p>
        </div>
        <button
          type="button"
          className={`rounded-md border px-3 py-2 text-sm ${
            isPinned
              ? "border-emerald-400 bg-emerald-500/20 text-emerald-200"
              : "border-slate-700 text-slate-300"
          }`}
          onClick={handlePin}
        >
          {isPinned ? "Pinned for compare" : "Pin for compare"}
        </button>
      </div>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <h3 className="text-lg font-semibold">Tier</h3>
          <p className="mt-2 text-2xl text-slate-100">{director.tier_ai || "—"}</p>
          <p className="text-sm text-slate-400">
            Confidence: {director.tier_ai_confidence || "—"}
          </p>
          <p className="text-sm text-slate-400">As of: {director.tier_ai_as_of || "—"}</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <h3 className="text-lg font-semibold">Availability</h3>
          <p className="mt-2 text-2xl text-slate-100">{director.availability_ai || "—"}</p>
          <p className="text-sm text-slate-400">
            Confidence: {director.availability_ai_confidence || "—"}
          </p>
          <p className="text-sm text-slate-400">
            As of: {director.availability_ai_as_of || "—"}
          </p>
        </div>
      </section>

      <section className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
        <h3 className="text-lg font-semibold">Evidence</h3>
        {evidenceUrls.length === 0 ? (
          <p className="text-sm text-slate-400">No evidence URLs recorded.</p>
        ) : (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {evidenceUrls.map((url) => (
              <li key={url}>
                <a href={url} target="_blank" rel="noreferrer">
                  {url}
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
        <h3 className="text-lg font-semibold">Internal Notes</h3>
        <p className="mt-2 text-sm text-slate-300">{director.internal_notes || "—"}</p>
        <p className="mt-2 text-sm text-slate-300">
          <span className="text-slate-400">Reps:</span> {director.reps_manual || "—"}
        </p>
      </section>

      <details className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
        <summary className="cursor-pointer text-lg font-semibold">Spreadsheet fields</summary>
        <div className="mt-4 grid gap-3">
          {Object.entries(director.manual_fields || {}).map(([key, value]) => (
            <div key={key} className="rounded-md border border-slate-800 bg-slate-950 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-400">{key}</p>
              <p className="mt-1 text-sm text-slate-200">{value || "—"}</p>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
