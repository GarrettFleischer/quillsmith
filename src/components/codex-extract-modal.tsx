"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CODEX_TYPES, CODEX_TYPE_SINGULAR, normalizeCodexType } from "@/lib/codex-ui";

type Proposal = {
  action: "create" | "update";
  id?: string;
  type: string;
  name: string;
  aliases: string;
  summary: string;
  reason: string;
  previousSummary?: string;
};

type Row = Proposal & { include: boolean };

export function CodexExtractModal({
  novelId,
  onClose,
  onSaved,
}: {
  novelId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/ai/extract-codex", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ novelId }),
        });
        const data = await res.json().catch(() => ({ error: "Failed" }));
        if (!res.ok) throw new Error(data.error || "Extraction failed");
        if (cancelled) return;
        const proposals: Proposal[] = Array.isArray(data.proposals) ? data.proposals : [];
        setRows(proposals.map((p) => ({ ...p, include: true })));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Extraction failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [novelId]);

  function patch(index: number, next: Partial<Row>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...next } : r)));
  }

  const selectedCount = rows.filter((r) => r.include).length;

  if (typeof document === "undefined") return null;

  async function save() {
    setSaving(true);
    setError("");
    try {
      for (const r of rows) {
        if (!r.include || !r.name.trim() || !r.summary.trim()) continue;
        await fetch(`/api/novels/${novelId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "upsertKnowledge",
            payload: {
              id: r.action === "update" ? r.id : undefined,
              type: normalizeCodexType(r.type),
              name: r.name.trim(),
              aliases: r.aliases.trim(),
              summary: r.summary.trim(),
            },
          }),
        });
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
      setSaving(false);
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-border bg-bg shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <h2 className="font-serif text-lg">Extract codex from your plan</h2>
            <p className="mt-0.5 text-xs text-muted">
              Proposed from your act/chapter summaries and beats. Edit or exclude, then save.
            </p>
          </div>
          <button
            type="button"
            className="cursor-pointer rounded px-2 py-1 text-sm text-muted hover:text-text"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
          {loading ? (
            <p className="py-8 text-center text-sm text-muted">Reading your plan…</p>
          ) : error ? (
            <p className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-danger">
              {error}
            </p>
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">
              Nothing new to extract from the current summaries and beats.
            </p>
          ) : (
            <ul className="space-y-3">
              {rows.map((r, i) => (
                <li
                  key={`${r.action}-${r.id ?? r.name}-${i}`}
                  className={`rounded-md border p-3 ${
                    r.include ? "border-border bg-surface/60" : "border-border/60 bg-surface/20 opacity-60"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1 cursor-pointer"
                      checked={r.include}
                      aria-label={`Include ${r.name}`}
                      onChange={(e) => patch(i, { include: e.target.checked })}
                    />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded px-1.5 py-px text-xs font-medium ${
                            r.action === "update"
                              ? "bg-accent-soft text-accent"
                              : "border border-border text-muted"
                          }`}
                        >
                          {r.action === "update" ? "Update" : "New"}
                        </span>
                        <select
                          className="rounded border border-border bg-bg px-1.5 py-1 text-xs"
                          value={normalizeCodexType(r.type)}
                          onChange={(e) => patch(i, { type: e.target.value })}
                        >
                          {CODEX_TYPES.map((t) => (
                            <option key={t} value={t}>
                              {CODEX_TYPE_SINGULAR[t]}
                            </option>
                          ))}
                        </select>
                        <input
                          className="min-w-0 flex-1 rounded border border-border bg-bg px-2 py-1 text-sm"
                          value={r.name}
                          placeholder="Name"
                          onChange={(e) => patch(i, { name: e.target.value })}
                        />
                      </div>
                      <input
                        className="w-full rounded border border-border bg-bg px-2 py-1 text-xs"
                        value={r.aliases}
                        placeholder="Aliases (comma-separated)"
                        onChange={(e) => patch(i, { aliases: e.target.value })}
                      />
                      <textarea
                        className="w-full rounded border border-border bg-bg px-2 py-1 text-sm"
                        rows={2}
                        value={r.summary}
                        placeholder="Summary"
                        onChange={(e) => patch(i, { summary: e.target.value })}
                      />
                      {r.action === "update" && r.previousSummary ? (
                        <p className="text-xs text-muted">
                          <span className="uppercase tracking-wide">was:</span> {r.previousSummary}
                        </p>
                      ) : null}
                      {r.reason ? (
                        <p className="text-xs text-muted">Why: {r.reason}</p>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
          <span className="text-xs text-muted">
            {loading ? "" : `${selectedCount} of ${rows.length} selected`}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              className="cursor-pointer rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface-2"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={loading || saving || selectedCount === 0}
              className="cursor-pointer rounded-md bg-accent px-3 py-1.5 text-sm text-bg disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => void save()}
            >
              {saving ? "Saving…" : `Save ${selectedCount || ""}`.trim()}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
