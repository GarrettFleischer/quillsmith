"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { buildRewriteHunks } from "@/lib/diff";
import { plainFromTipTap } from "@/lib/utils";

type Revision = { id: string; createdAt: string; source: string; content: string };

function sourceLabel(source: string) {
  if (source === "ai") return "AI";
  if (source === "restore") return "Restored";
  return "You";
}

export function BeatHistoryModal({
  novelId,
  beatId,
  label,
  onClose,
  onRestored,
}: {
  novelId: string;
  beatId: string;
  label: string;
  onClose: () => void;
  onRestored: (content: string) => void;
}) {
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [selected, setSelected] = useState(0);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/novels/${novelId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "listBeatRevisions", payload: { beatId } }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load history");
        if (!cancelled) setRevisions(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load history");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [novelId, beatId]);

  // Revisions are newest-first; diff a revision against the one before it.
  const hunks = useMemo(() => {
    const cur = revisions[selected];
    if (!cur) return [];
    const older = revisions[selected + 1];
    return buildRewriteHunks(older ? plainFromTipTap(older.content) : "", plainFromTipTap(cur.content));
  }, [revisions, selected]);

  // The oldest version has no "before", so show it as a single passage.
  const hasBefore = selected + 1 < revisions.length;
  const firstText = revisions[selected] ? plainFromTipTap(revisions[selected].content) : "";

  async function restore() {
    const rev = revisions[selected];
    if (!rev) return;
    setRestoring(true);
    setError("");
    try {
      const res = await fetch(`/api/novels/${novelId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restoreBeatRevision", payload: { beatId, revisionId: rev.id } }),
      });
      if (!res.ok) throw new Error("Restore failed");
      onRestored(rev.content);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Restore failed");
      setRestoring(false);
    }
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-border bg-bg shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <h2 className="font-serif text-lg">Beat history</h2>
            <p className="mt-0.5 text-xs text-muted">{label} — pick a version to see what changed, then restore.</p>
          </div>
          <button
            type="button"
            className="cursor-pointer rounded px-2 py-1 text-sm text-muted hover:text-text"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="flex min-h-0 flex-1">
          <div className="w-[220px] shrink-0 overflow-auto border-r border-border p-2">
            {loading ? (
              <p className="px-2 py-3 text-sm text-muted">Loading…</p>
            ) : revisions.length === 0 ? (
              <p className="px-2 py-3 text-sm text-muted">No history yet.</p>
            ) : (
              revisions.map((r, i) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelected(i)}
                  className={`mb-0.5 flex w-full flex-col gap-0.5 rounded-md px-2 py-1.5 text-left ${
                    i === selected ? "bg-accent-soft ring-1 ring-accent/40" : "hover:bg-surface-2"
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className={`rounded px-1.5 py-px text-xs ${r.source === "ai" ? "bg-accent-soft text-accent" : "border border-border text-muted"}`}>
                      {sourceLabel(r.source)}
                    </span>
                    {i === 0 ? <span className="text-xs text-muted">latest</span> : null}
                  </span>
                  <span className="text-xs text-muted">{new Date(r.createdAt).toLocaleString()}</span>
                </button>
              ))
            )}
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {error ? <p className="px-4 pt-3 text-sm text-danger">{error}</p> : null}
            {revisions.length === 0 && !loading ? (
              <p className="p-4 text-sm text-muted">
                As you write (after a 10s pause) or use “Write with AI”, versions are saved here.
              </p>
            ) : !hasBefore ? (
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <div className="border-b border-border px-4 py-1.5 text-xs uppercase tracking-wide text-muted">
                  First version
                </div>
                <p className="manuscript min-h-0 flex-1 overflow-auto whitespace-pre-wrap p-4 text-base leading-relaxed">
                  {firstText || <span className="text-muted">(empty)</span>}
                </p>
              </div>
            ) : (
              <div className="grid min-h-0 flex-1 grid-cols-2">
                <div className="flex min-h-0 flex-col overflow-hidden border-r border-border">
                  <div className="border-b border-border px-4 py-1.5 text-xs uppercase tracking-wide text-muted">
                    Original
                  </div>
                  <p className="manuscript min-h-0 flex-1 overflow-auto whitespace-pre-wrap p-4 text-base leading-relaxed">
                    {hunks.map((h) => h.original).join("")}
                  </p>
                </div>
                <div className="flex min-h-0 flex-col overflow-hidden">
                  <div className="border-b border-border px-4 py-1.5 text-xs uppercase tracking-wide text-muted">
                    New
                  </div>
                  <p className="manuscript min-h-0 flex-1 overflow-auto whitespace-pre-wrap p-4 text-base leading-relaxed">
                    {hunks.map((h) =>
                      h.type === "equal" ? (
                        <span key={h.id}>{h.revised}</span>
                      ) : h.type === "delete" ? null : (
                        <span key={h.id} className="rounded bg-accent-soft text-accent">
                          {h.revised}
                        </span>
                      ),
                    )}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
          <button
            type="button"
            className="cursor-pointer rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface-2"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={loading || restoring || revisions.length === 0}
            className="cursor-pointer rounded-md bg-accent px-3 py-1.5 text-sm text-bg disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => void restore()}
          >
            {restoring ? "Restoring…" : "Restore this version"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
