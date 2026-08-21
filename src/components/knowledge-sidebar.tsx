"use client";

import { useEffect, useMemo, useState } from "react";
import { SliderFields } from "@/components/slider-fields";
import { CHARACTER_SLIDERS, parseSliderMap } from "@/lib/sliders";

export type KnowledgeEntry = {
  id: string;
  type: string;
  name: string;
  aliases: string | null;
  summary: string | null;
  notes: string | null;
  slidersJson?: string | null;
};

export type StoryFields = {
  title: string;
  premise: string | null;
  genre: string | null;
  tone: string | null;
  themes: string | null;
  stakes: string | null;
  protagonistFocus: string | null;
  endingIntention: string | null;
  notes: string | null;
  styleGuideJson: string | null;
};

const CODEX_TYPES = ["character", "lore", "location", "item", "other"] as const;

export function KnowledgeSidebar({
  novelId,
  entries,
  story,
  onChange,
  onJumpToProse,
  onCollapse,
  className,
}: {
  novelId: string;
  entries: KnowledgeEntry[];
  story: StoryFields;
  onChange: () => void;
  onJumpToProse: (sceneId: string) => void;
  onCollapse?: () => void;
  className?: string;
}) {
  const [selected, setSelected] = useState<string | "story" | null>("story");
  const [filter, setFilter] = useState("");
  const [draft, setDraft] = useState({
    type: "character",
    name: "",
    aliases: "",
    summary: "",
    notes: "",
    sliders: {} as Record<string, number>,
  });
  const [storyDraft, setStoryDraft] = useState({
    premise: story.premise ?? "",
    genre: story.genre ?? "",
    tone: story.tone ?? "",
    themes: story.themes ?? "",
    stakes: story.stakes ?? "",
    protagonistFocus: story.protagonistFocus ?? "",
    endingIntention: story.endingIntention ?? "",
    notes: story.notes ?? "",
    styleGuide: story.styleGuideJson ?? "",
  });
  const [appearances, setAppearances] = useState<
    Array<{ id: string; sceneId: string; contextSnippet: string }>
  >([]);
  const [proposed, setProposed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [quickAdd, setQuickAdd] = useState({ type: "character", name: "" });

  const entry = entries.find((e) => e.id === selected) ?? null;
  const filtered = entries.filter(
    (e) =>
      e.name.toLowerCase().includes(filter.toLowerCase()) ||
      (e.aliases ?? "").toLowerCase().includes(filter.toLowerCase()) ||
      e.type.toLowerCase().includes(filter.toLowerCase()),
  );
  const grouped = useMemo(() => {
    const map = new Map<string, KnowledgeEntry[]>();
    for (const t of CODEX_TYPES) map.set(t, []);
    for (const e of filtered) {
      const raw = e.type === "place" ? "location" : e.type;
      const key = CODEX_TYPES.includes(raw as (typeof CODEX_TYPES)[number]) ? raw : "other";
      map.set(key, [...(map.get(key) ?? []), e]);
    }
    return map;
  }, [filtered]);

  useEffect(() => {
    setStoryDraft({
      premise: story.premise ?? "",
      genre: story.genre ?? "",
      tone: story.tone ?? "",
      themes: story.themes ?? "",
      stakes: story.stakes ?? "",
      protagonistFocus: story.protagonistFocus ?? "",
      endingIntention: story.endingIntention ?? "",
      notes: story.notes ?? "",
      styleGuide: story.styleGuideJson ?? "",
    });
  }, [story]);

  useEffect(() => {
    if (!selected || selected === "story") {
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
        payload: {
          id,
          type: draft.type,
          name: draft.name,
          aliases: draft.aliases,
          summary: draft.summary,
          notes: draft.notes,
          slidersJson: JSON.stringify(draft.sliders),
        },
      }),
    });
    setDraft({ type: "character", name: "", aliases: "", summary: "", notes: "", sliders: {} });
    onChange();
  }

  async function saveStory() {
    await fetch(`/api/novels/${novelId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "updateNovel",
        payload: {
          premise: storyDraft.premise,
          genre: storyDraft.genre,
          tone: storyDraft.tone,
          themes: storyDraft.themes,
          stakes: storyDraft.stakes,
          protagonistFocus: storyDraft.protagonistFocus,
          endingIntention: storyDraft.endingIntention,
          notes: storyDraft.notes,
          styleGuideJson: storyDraft.styleGuide,
        },
      }),
    });
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
          <h2 className="font-serif text-lg">Codex</h2>
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
          <li>
            <button
              type="button"
              onClick={() => setSelected("story")}
              className={`w-full rounded px-2 py-2 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset ${
                selected === "story" ? "bg-accent-soft text-accent" : "hover:bg-surface-2"
              }`}
            >
              <span className="block font-medium">{story.title || "Story"}</span>
              <span className="text-xs uppercase tracking-wide text-muted">Story</span>
            </button>
          </li>
          {CODEX_TYPES.map((type) => {
            const rows = grouped.get(type) ?? [];
            if (filter && rows.length === 0) return null;
            return (
              <li key={type} className="mt-2">
                <p className="px-2 pb-1 text-[11px] uppercase tracking-wide text-muted">{type}</p>
                {rows.length === 0 ? (
                  <p className="px-2 pb-1 text-xs text-muted">None yet</p>
                ) : (
                  rows.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => {
                        setSelected(e.id);
                        setDraft({
                          type: e.type,
                          name: e.name,
                          aliases: e.aliases ?? "",
                          summary: e.summary ?? "",
                          notes: e.notes ?? "",
                          sliders: parseSliderMap(e.slidersJson),
                        });
                      }}
                      className={`mb-0.5 w-full rounded px-2 py-1.5 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset ${
                        selected === e.id ? "bg-accent-soft text-accent" : "hover:bg-surface-2"
                      }`}
                    >
                      {e.name}
                    </button>
                  ))
                )}
              </li>
            );
          })}
        </ul>
        <div className="border-t border-border p-2">
          <p className="px-1 pb-1 text-[11px] uppercase tracking-wide text-muted">Quick add</p>
          <input
            className="mb-1 w-full rounded border border-border bg-bg px-2 py-1 text-sm"
            placeholder="Name"
            value={quickAdd.name}
            onChange={(e) => setQuickAdd((d) => ({ ...d, name: e.target.value }))}
          />
          <div className="flex gap-1">
            <select
              className="min-w-0 flex-1 rounded border border-border bg-bg px-1 py-1 text-xs"
              value={quickAdd.type}
              onChange={(e) => setQuickAdd((d) => ({ ...d, type: e.target.value }))}
            >
              {CODEX_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="rounded bg-accent px-2 py-1 text-xs text-bg disabled:opacity-50"
              onClick={async () => {
                if (!quickAdd.name.trim()) return;
                await fetch(`/api/novels/${novelId}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    action: "upsertKnowledge",
                    payload: { type: quickAdd.type, name: quickAdd.name.trim() },
                  }),
                });
                setQuickAdd({ type: "character", name: "" });
                onChange();
              }}
              disabled={!quickAdd.name.trim()}
            >
              Add
            </button>
          </div>
        </div>
      </div>

      <div className="max-h-[55%] overflow-auto border-t border-border p-3 text-sm">
        {selected === "story" ? (
          <>
            <p className="mb-2 font-medium">Story</p>
            {(
              [
                ["premise", "Premise"],
                ["genre", "Genre"],
                ["tone", "Tone"],
                ["themes", "Themes"],
                ["stakes", "Stakes"],
                ["protagonistFocus", "Protagonist"],
                ["endingIntention", "Ending intention"],
                ["notes", "Notes"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="mb-2 block text-xs text-muted">
                {label}
                <textarea
                  className="mt-0.5 w-full rounded border border-border bg-bg px-2 py-1 text-sm text-text"
                  rows={key === "premise" || key === "notes" ? 3 : 2}
                  value={storyDraft[key]}
                  onChange={(e) => setStoryDraft((d) => ({ ...d, [key]: e.target.value }))}
                />
              </label>
            ))}
            <label className="mb-2 block text-xs text-muted">
              Style guide (JSON or notes)
              <textarea
                className="mt-0.5 w-full rounded border border-border bg-bg px-2 py-1 font-mono text-xs text-text"
                rows={4}
                value={storyDraft.styleGuide}
                onChange={(e) => setStoryDraft((d) => ({ ...d, styleGuide: e.target.value }))}
              />
            </label>
            <button
              type="button"
              className="rounded bg-accent px-2 py-1 text-xs text-bg"
              onClick={() => void saveStory()}
            >
              Save story
            </button>
          </>
        ) : entry ? (
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
              {CODEX_TYPES.map((t) => (
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
            {draft.type === "character" ? (
              <div className="mb-2">
                <p className="mb-1 text-xs text-muted">Baseline sliders</p>
                <SliderFields
                  defs={CHARACTER_SLIDERS}
                  values={draft.sliders}
                  onChange={(id, value) =>
                    setDraft((d) => ({ ...d, sliders: { ...d.sliders, [id]: value } }))
                  }
                />
              </div>
            ) : null}
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
                      onClick={() => onJumpToProse(a.sceneId)}
                    >
                      {a.contextSnippet}
                    </button>
                  </li>
                ))}
                {appearances.length === 0 ? (
                  <li className="text-xs text-muted">None yet — write and save this chapter.</li>
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
              {CODEX_TYPES.map((t) => (
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
