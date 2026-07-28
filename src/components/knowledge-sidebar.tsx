"use client";

import { useEffect, useState } from "react";

export type KnowledgeEntry = {
  id: string;
  type: string;
  name: string;
  aliases: string | null;
  summary: string | null;
  notes: string | null;
};

export function KnowledgeSidebar({
  novelId,
  entries,
  onChange,
  onJumpToScene,
  onCollapse,
  className,
}: {
  novelId: string;
  entries: KnowledgeEntry[];
  onChange: () => void;
  onJumpToScene: (sceneId: string) => void;
  onCollapse?: () => void;
  className?: string;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [draft, setDraft] = useState({
    type: "character",
    name: "",
    aliases: "",
    summary: "",
    notes: "",
  });
  const [appearances, setAppearances] = useState<
    Array<{ id: string; sceneId: string; contextSnippet: string }>
  >([]);
  const [proposed, setProposed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const entry = entries.find((e) => e.id === selected) ?? null;
  const filtered = entries.filter(
    (e) =>
      e.name.toLowerCase().includes(filter.toLowerCase()) ||
      (e.aliases ?? "").toLowerCase().includes(filter.toLowerCase()),
  );

  useEffect(() => {
    if (!selected) {
      setAppearances([]);
      return;
    }
    void fetch(`/api/novels/${novelId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "listAppearances", payload: { entryId: selected } }),
    })
      .then((r) => r.json())
      .then(setAppearances);
  }, [selected, novelId]);

  async function saveEntry(id?: string) {
    await fetch(`/api/novels/${novelId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "upsertKnowledge",
        payload: { id, ...draft },
      }),
    });
    setDraft({ type: "character", name: "", aliases: "", summary: "", notes: "" });
    onChange();
  }

  async function updateSummary() {
    if (!entry) return;
    setBusy(true);
    setProposed(null);
    try {
      const res = await fetch("/api/ai/summarize-entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId: entry.id, novelId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setProposed(data.proposedSummary);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function acceptSummary() {
    if (!entry || !proposed) return;
    await fetch("/api/ai/summarize-entry", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entryId: entry.id, novelId, summary: proposed }),
    });
    setProposed(null);
    onChange();
  }

  return (
    <aside
      className={`flex h-full min-h-0 w-[280px] shrink-0 flex-col border-r border-border bg-surface/70 panel-enter ${className ?? ""}`}
    >
      <div className="border-b border-border px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-serif text-lg">Knowledge</h2>
          {onCollapse ? (
            <button
              type="button"
              className="text-xs text-muted hover:text-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              onClick={onCollapse}
            >
              Hide
            </button>
          ) : null}
        </div>
        <input
          className="mt-2 w-full rounded-md border border-border bg-bg px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          placeholder="Search…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <ul className="p-2">
          {filtered.length === 0 ? (
            <li className="px-2 py-4 text-sm text-muted">
              {entries.length === 0
                ? "No lore entries yet — add characters and places as you draft."
                : "No matches for that search."}
            </li>
          ) : null}
          {filtered.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => {
                  setSelected(e.id);
                  setDraft({
                    type: e.type,
                    name: e.name,
                    aliases: e.aliases ?? "",
                    summary: e.summary ?? "",
                    notes: e.notes ?? "",
                  });
                }}
                className={`w-full rounded px-2 py-2 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset ${
                  selected === e.id ? "bg-accent-soft text-accent" : "hover:bg-surface-2"
                }`}
              >
                <span className="block font-medium">{e.name}</span>
                <span className="text-xs uppercase tracking-wide text-muted">{e.type}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="max-h-[55%] overflow-auto border-t border-border p-3 text-sm">
        {entry ? (
          <>
            <label className="block text-xs text-muted">Name</label>
            <input
              className="mb-2 w-full rounded border border-border bg-bg px-2 py-1"
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            />
            <label className="block text-xs text-muted">Type</label>
            <select
              className="mb-2 w-full rounded border border-border bg-bg px-2 py-1"
              value={draft.type}
              onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value }))}
            >
              {["character", "location", "item", "other"].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <label className="block text-xs text-muted">Aliases</label>
            <input
              className="mb-2 w-full rounded border border-border bg-bg px-2 py-1"
              value={draft.aliases}
              onChange={(e) => setDraft((d) => ({ ...d, aliases: e.target.value }))}
            />
            <label className="block text-xs text-muted">Summary</label>
            <textarea
              className="mb-2 w-full rounded border border-border bg-bg px-2 py-1"
              rows={4}
              value={draft.summary}
              onChange={(e) => setDraft((d) => ({ ...d, summary: e.target.value }))}
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded bg-accent px-2 py-1 text-xs text-bg"
                onClick={() => void saveEntry(entry.id)}
              >
                Save
              </button>
              <button
                type="button"
                disabled={busy}
                className="rounded border border-border px-2 py-1 text-xs"
                onClick={() => void updateSummary()}
              >
                {busy ? "Updating…" : "Update summary"}
              </button>
            </div>
            {proposed ? (
              <div className="mt-3 rounded border border-border bg-bg p-2">
                <p className="text-xs text-muted">Proposed</p>
                <p className="mt-1 whitespace-pre-wrap">{proposed}</p>
                <button
                  type="button"
                  className="mt-2 rounded bg-accent px-2 py-1 text-xs text-bg"
                  onClick={() => void acceptSummary()}
                >
                  Accept
                </button>
              </div>
            ) : null}
            <div className="mt-4">
              <p className="text-xs uppercase tracking-wide text-muted">Appearances</p>
              <ul className="mt-2 space-y-2">
                {appearances.map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      className="text-left text-xs text-accent hover:underline"
                      onClick={() => onJumpToScene(a.sceneId)}
                    >
                      {a.contextSnippet}
                    </button>
                  </li>
                ))}
                {appearances.length === 0 ? (
                  <li className="text-xs text-muted">None yet — write and save scenes.</li>
                ) : null}
              </ul>
            </div>
          </>
        ) : (
          <>
            <p className="mb-2 font-medium">New entry</p>
            <input
              className="mb-2 w-full rounded border border-border bg-bg px-2 py-1"
              placeholder="Name"
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            />
            <select
              className="mb-2 w-full rounded border border-border bg-bg px-2 py-1"
              value={draft.type}
              onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value }))}
            >
              {["character", "location", "item", "other"].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="rounded bg-accent px-2 py-1 text-xs text-bg"
              onClick={() => void saveEntry()}
              disabled={!draft.name.trim()}
            >
              Add
            </button>
          </>
        )}
      </div>
    </aside>
  );
}
