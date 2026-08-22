"use client";

import { useEffect, useRef, useState } from "react";

export type Beat = { id: string; content: string; order: number };

export function BeatsSidebar({
  novelId,
  chapterId,
  chapterTitle,
  chapterSummary,
  beats,
  hasApiKey = true,
  onChange,
  onCollapse,
  className,
}: {
  novelId: string;
  chapterId: string | null;
  chapterTitle?: string;
  chapterSummary?: string;
  beats: Beat[];
  hasApiKey?: boolean;
  onChange: () => void;
  onCollapse?: () => void;
  className?: string;
}) {
  // Keyed by chapter id in the parent, so this initializer refreshes on switch;
  // in-place mutations below keep `items` in sync without a prop-sync effect.
  const [items, setItems] = useState(beats);
  const [draft, setDraft] = useState("");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef<HTMLUListElement>(null);

  // Pointer-based drag reorder (works with mouse and touch).
  useEffect(() => {
    if (!draggingId || !chapterId) return;

    const onMove = (e: PointerEvent) => {
      const list = listRef.current;
      if (!list) return;
      const rows = Array.from(
        list.querySelectorAll<HTMLElement>("[data-beat-id]"),
      );
      const over = rows.find((el) => {
        const r = el.getBoundingClientRect();
        return e.clientY >= r.top && e.clientY <= r.bottom;
      });
      const overId = over?.getAttribute("data-beat-id");
      if (!overId || overId === draggingId) return;
      setItems((prev) => {
        const from = prev.findIndex((b) => b.id === draggingId);
        const to = prev.findIndex((b) => b.id === overId);
        if (from === -1 || to === -1 || from === to) return prev;
        const next = [...prev];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        return next;
      });
    };

    const onUp = () => {
      setDraggingId(null);
      setItems((prev) => {
        void fetch(`/api/novels/${novelId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "reorderBeats",
            payload: { chapterId, orderedIds: prev.map((b) => b.id) },
          }),
        }).then(() => onChange());
        return prev;
      });
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draggingId, chapterId]);

  if (!chapterId) {
    return (
      <aside
        className={`flex h-full w-[240px] shrink-0 flex-col border-l border-border bg-surface/70 p-3 ${className ?? ""}`}
      >
        <h2 className="font-serif text-lg">Beats</h2>
        <p className="mt-3 text-sm text-muted">Open a chapter to edit its beats.</p>
      </aside>
    );
  }

  async function saveBeat(id: string | undefined, content: string) {
    const res = await fetch(`/api/novels/${novelId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "upsertBeat",
        payload: { id, chapterId, content },
      }),
    });
    const saved = (await res.json().catch(() => null)) as Beat | null;
    if (!id && saved?.id) setItems((prev) => [...prev, saved]);
    onChange();
  }

  async function removeBeat(beatId: string) {
    setItems((prev) => prev.filter((b) => b.id !== beatId));
    await fetch(`/api/novels/${novelId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "deleteBeat", payload: { beatId } }),
    });
    onChange();
  }

  async function generateBeats() {
    if (!chapterSummary?.trim()) {
      setError("Write a chapter summary first — beats are generated from it.");
      return;
    }
    setGenerating(true);
    setError("");
    try {
      const res = await fetch("/api/ai/generate-beats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ novelId, chapterId }),
      });
      const data = await res.json().catch(() => ({ error: "Failed" }));
      if (!res.ok) throw new Error(data.error || "Failed to generate beats");
      if (Array.isArray(data.beats)) setItems(data.beats);
      onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate beats");
    } finally {
      setGenerating(false);
    }
  }

  const canGenerate = hasApiKey && Boolean(chapterSummary?.trim());

  return (
    <aside
      className={`flex h-full min-h-0 w-[240px] shrink-0 flex-col border-l border-border bg-surface/70 ${className ?? ""}`}
    >
      <div className="border-b border-border px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-serif text-lg">Beats</h2>
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
        <p className="mt-1 text-xs text-muted">{chapterTitle}</p>
      </div>
      <ul ref={listRef} className="min-h-0 flex-1 space-y-2 overflow-auto p-3">
        {items.length === 0 ? (
          <li className="rounded-md border border-dashed border-border/70 px-2 py-3 text-xs text-muted">
            No beats yet. Write a summary, then Generate beats — or add your own below.
          </li>
        ) : null}
        {items.map((b) => (
          <li
            key={b.id}
            data-beat-id={b.id}
            className={`rounded-md border border-border bg-bg p-2 transition ${
              draggingId === b.id ? "opacity-60 ring-1 ring-accent" : ""
            }`}
          >
            <div className="flex items-start gap-1.5">
              <button
                type="button"
                aria-label="Drag to reorder beat"
                title="Drag to reorder"
                onPointerDown={(e) => {
                  e.preventDefault();
                  setDraggingId(b.id);
                }}
                className="mt-0.5 shrink-0 cursor-grab touch-none select-none rounded px-1 py-0.5 text-muted hover:bg-surface-2 hover:text-text active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <GripIcon className="h-4 w-4" />
              </button>
              <textarea
                className="w-full resize-y bg-transparent text-sm outline-none"
                rows={3}
                value={b.content}
                onChange={(e) =>
                  setItems((prev) =>
                    prev.map((x) => (x.id === b.id ? { ...x, content: e.target.value } : x)),
                  )
                }
                onBlur={(e) => void saveBeat(b.id, e.target.value)}
              />
            </div>
            <div className="mt-1 flex justify-end">
              <button
                type="button"
                className="cursor-pointer text-xs text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                onClick={() => void removeBeat(b.id)}
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
      <div className="border-t border-border p-3">
        <button
          type="button"
          disabled={!canGenerate || generating}
          title={
            !hasApiKey
              ? "Add an OpenRouter key in Settings"
              : !chapterSummary?.trim()
                ? "Write a chapter summary first"
                : "Generate beats from the chapter summary"
          }
          className="mb-2 w-full cursor-pointer rounded-md border border-accent px-2 py-1.5 text-xs font-medium text-accent hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => void generateBeats()}
        >
          {generating ? "Generating beats…" : "Generate beats from summary"}
        </button>
        {error ? <p className="mb-2 text-xs text-danger">{error}</p> : null}
        <textarea
          className="w-full rounded-md border border-border bg-bg px-2 py-1 text-sm"
          rows={2}
          placeholder="New beat…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button
          type="button"
          className="mt-2 cursor-pointer rounded-md bg-accent px-2 py-1 text-xs text-bg disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!draft.trim()}
          onClick={async () => {
            await saveBeat(undefined, draft.trim());
            setDraft("");
          }}
        >
          Add beat
        </button>
      </div>
    </aside>
  );
}

function GripIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className={className} aria-hidden="true">
      <circle cx="6" cy="3.5" r="1.3" />
      <circle cx="10" cy="3.5" r="1.3" />
      <circle cx="6" cy="8" r="1.3" />
      <circle cx="10" cy="8" r="1.3" />
      <circle cx="6" cy="12.5" r="1.3" />
      <circle cx="10" cy="12.5" r="1.3" />
    </svg>
  );
}
