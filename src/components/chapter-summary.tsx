"use client";

import { useState } from "react";

export function ChapterSummaryRail({
  novelId,
  chapterId,
  chapterTitle,
  chapterSummary,
  actId,
  actTitle,
  actSummary,
  onChange,
  onCollapse,
  className,
}: {
  novelId: string;
  chapterId: string | null;
  chapterTitle?: string;
  chapterSummary?: string;
  actId?: string | null;
  actTitle?: string;
  actSummary?: string;
  onChange: () => void;
  onCollapse?: () => void;
  className?: string;
}) {
  // Keyed by chapter id in the parent, so initializers refresh on chapter switch.
  const [summary, setSummary] = useState(chapterSummary ?? "");
  const [act, setAct] = useState(actSummary ?? "");

  if (!chapterId) {
    return (
      <aside
        className={`flex h-full w-[260px] shrink-0 flex-col border-l border-border bg-surface/70 p-3 ${className ?? ""}`}
      >
        <h2 className="font-serif text-lg">Summary</h2>
        <p className="mt-3 text-sm text-muted">Open a chapter to edit its summary.</p>
      </aside>
    );
  }

  async function saveSummary(scope: "act" | "chapter", value: string) {
    await fetch("/api/ai/summarize-chapter", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        scope === "act"
          ? { novelId, actId, summary: value }
          : { novelId, chapterId, summary: value },
      ),
    });
    onChange();
  }

  return (
    <aside
      className={`flex h-full min-h-0 w-[260px] shrink-0 flex-col border-l border-border bg-surface/70 ${className ?? ""}`}
    >
      <div className="border-b border-border px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-serif text-lg">Summary</h2>
          {onCollapse ? (
            <button
              type="button"
              className="cursor-pointer text-xs text-muted hover:underline"
              onClick={onCollapse}
            >
              Hide
            </button>
          ) : null}
        </div>
        <p className="mt-1 text-xs text-muted">Plan top-down: act, then chapter.</p>
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-auto p-3">
        {actId ? (
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
              Act summary{actTitle ? ` · ${actTitle}` : ""}
            </label>
            <textarea
              className="min-h-[7rem] w-full rounded-md border border-border bg-bg px-2 py-2 text-sm"
              placeholder="Where this act begins and ends; what changes across it…"
              value={act}
              onChange={(e) => setAct(e.target.value)}
              onBlur={(e) => {
                if (e.target.value === (actSummary ?? "")) return;
                void saveSummary("act", e.target.value);
              }}
            />
          </div>
        ) : null}
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
            Chapter summary{chapterTitle ? ` · ${chapterTitle}` : ""}
          </label>
          <textarea
            className="min-h-[10rem] w-full rounded-md border border-border bg-bg px-2 py-2 text-sm"
            placeholder="What happens, who changes, promises left open…"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            onBlur={(e) => {
              if (e.target.value === (chapterSummary ?? "")) return;
              void saveSummary("chapter", e.target.value);
            }}
          />
          <p className="mt-1 text-xs text-muted">
            Write the summary first, then use “Generate beats” in the Beats panel.
          </p>
        </div>
      </div>
    </aside>
  );
}
