"use client";

import { useEffect, useState } from "react";

export type Beat = { id: string; content: string; order: number };

export function BeatsSidebar({
  novelId,
  chapterId,
  chapterTitle,
  beats,
  onChange,
}: {
  novelId: string;
  chapterId: string | null;
  chapterTitle?: string;
  beats: Beat[];
  onChange: () => void;
}) {
  const [items, setItems] = useState(beats);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    setItems(beats);
  }, [beats]);

  if (!chapterId) {
    return (
      <aside className="flex h-full w-[260px] shrink-0 flex-col border-l border-border bg-surface/70 p-3">
        <h2 className="font-serif text-lg">Beats</h2>
        <p className="mt-3 text-sm text-muted">
          Place the cursor in a chapter’s scene to edit its outline beats.
        </p>
      </aside>
    );
  }

  async function saveBeat(id: string | undefined, content: string) {
    await fetch(`/api/novels/${novelId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "upsertBeat",
        payload: { id, chapterId, content },
      }),
    });
    onChange();
  }

  async function removeBeat(beatId: string) {
    await fetch(`/api/novels/${novelId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "deleteBeat", payload: { beatId } }),
    });
    onChange();
  }

  async function move(index: number, dir: -1 | 1) {
    const next = [...items];
    const j = index + dir;
    if (j < 0 || j >= next.length) return;
    [next[index], next[j]] = [next[j], next[index]];
    setItems(next);
    await fetch(`/api/novels/${novelId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "reorderBeats",
        payload: { chapterId, orderedIds: next.map((b) => b.id) },
      }),
    });
    onChange();
  }

  return (
    <aside className="flex h-full w-[260px] shrink-0 flex-col border-l border-border bg-surface/70">
      <div className="border-b border-border px-3 py-3">
        <h2 className="font-serif text-lg">Beats</h2>
        <p className="mt-1 text-xs text-muted">{chapterTitle}</p>
      </div>
      <ul className="flex-1 space-y-2 overflow-auto p-3">
        {items.map((b, i) => (
          <li key={b.id} className="rounded border border-border bg-bg p-2">
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
            <div className="mt-1 flex gap-2 text-xs text-muted">
              <button type="button" onClick={() => void move(i, -1)}>
                Up
              </button>
              <button type="button" onClick={() => void move(i, 1)}>
                Down
              </button>
              <button type="button" className="text-danger" onClick={() => void removeBeat(b.id)}>
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
      <div className="border-t border-border p-3">
        <textarea
          className="w-full rounded border border-border bg-bg px-2 py-1 text-sm"
          rows={2}
          placeholder="New beat…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button
          type="button"
          className="mt-2 rounded bg-accent px-2 py-1 text-xs text-bg"
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
