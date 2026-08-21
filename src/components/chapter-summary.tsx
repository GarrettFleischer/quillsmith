"use client";

import { useEffect, useState } from "react";

export function ChapterSummaryRail({
  novelId,
  chapterId,
  chapterTitle,
  chapterSummary,
  onChange,
  onCollapse,
  className,
}: {
  novelId: string;
  chapterId: string | null;
  chapterTitle?: string;
  chapterSummary?: string;
  onChange: () => void;
  onCollapse?: () => void;
  className?: string;
}) {
  const [summary, setSummary] = useState(chapterSummary ?? "");
  const [proposed, setProposed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSummary(chapterSummary ?? "");
    setProposed(null);
  }, [chapterId, chapterSummary]);

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
              className="text-xs text-muted hover:underline"
              onClick={onCollapse}
            >
              Hide
            </button>
          ) : null}
        </div>
        <p className="mt-1 text-xs text-muted">{chapterTitle}</p>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3">
        <textarea
          className="h-full min-h-[12rem] w-full rounded-md border border-border bg-bg px-2 py-2 text-sm"
          placeholder="What happens, who changes, promises left open…"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          onBlur={async (e) => {
            const next = e.target.value;
            if (next === (chapterSummary ?? "")) return;
            await fetch(`/api/novels/${novelId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "upsertChapter",
                payload: { id: chapterId, title: chapterTitle, summary: next },
              }),
            });
            onChange();
          }}
        />
      </div>
      <div className="border-t border-border p-3">
        <button
          type="button"
          disabled={busy}
          className="text-[11px] text-accent hover:underline disabled:opacity-50"
          onClick={async () => {
            setBusy(true);
            try {
              const res = await fetch("/api/ai/summarize-chapter", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ novelId, chapterId }),
              });
              const data = await res.json();
              if (!res.ok) throw new Error(data.error || "Failed");
              setProposed(data.proposedSummary);
            } catch {
              setProposed(null);
            } finally {
              setBusy(false);
            }
          }}
        >
          Refresh with AI
        </button>
        {proposed ? (
          <div className="mt-2 rounded-md border border-border bg-bg p-2 text-xs">
            <p className="whitespace-pre-wrap">{proposed}</p>
            <div className="mt-1 flex gap-2">
              <button
                type="button"
                className="text-accent hover:underline"
                onClick={async () => {
                  await fetch("/api/ai/summarize-chapter", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ novelId, chapterId, summary: proposed }),
                  });
                  setSummary(proposed);
                  setProposed(null);
                  onChange();
                }}
              >
                Approve
              </button>
              <button type="button" className="text-muted" onClick={() => setProposed(null)}>
                Discard
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
