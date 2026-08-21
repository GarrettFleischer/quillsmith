"use client";

import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { SliderFields } from "@/components/slider-fields";
import {
  IconDoc,
  IconItem,
  IconMapPin,
  IconScroll,
  IconStory,
} from "@/components/codex-icons";
import { CODEX_TYPES, CODEX_TYPE_SINGULAR, normalizeCodexType, wordCount, type CodexType } from "@/lib/codex-ui";
import { CHARACTER_SLIDERS, parseSliderMap } from "@/lib/sliders";
import { type CodexTarget } from "@/store/workspace";
import type { KnowledgeEntry, StoryFields } from "@/components/knowledge-sidebar";

function TypeGlyph({ type, name }: { type: CodexType | "story"; name: string }) {
  const cls = "h-8 w-8 text-muted";
  if (type === "story") return <IconStory className={cls} />;
  if (type === "location") return <IconMapPin className={cls} />;
  if (type === "lore") return <IconScroll className={cls} />;
  if (type === "item") return <IconItem className={cls} />;
  if (type === "character") {
    return (
      <span className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-sm text-muted">
        {(name.trim()[0] || "?").toUpperCase()}
      </span>
    );
  }
  return <IconDoc className={cls} />;
}

export function CodexEntryEditor({
  windowId,
  target,
  novelId,
  entries,
  story,
  onChange,
  onJumpToProse,
  onCreated,
  onDeleted,
}: {
  windowId: string;
  target: CodexTarget;
  novelId: string;
  entries: KnowledgeEntry[];
  story: StoryFields;
  onChange: () => void;
  onJumpToProse: (sceneId: string) => void;
  onCreated: (windowId: string, entryId: string) => void;
  onDeleted: (entryId: string) => void;
}) {
  const entry = target.kind === "entry" ? (entries.find((e) => e.id === target.entryId) ?? null) : null;
  const [tab, setTab] = useState<"details" | "mentions">("details");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [proposed, setProposed] = useState<string | null>(null);
  const [appearances, setAppearances] = useState<
    Array<{ id: string; sceneId: string; contextSnippet: string }>
  >([]);
  const [draft, setDraft] = useState({
    type: "character" as CodexType,
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

  const targetKey =
    target.kind === "story" ? "story" : target.kind === "new" ? `new:${target.type}` : target.entryId;

  useEffect(() => {
    setTab("details");
    setProposed(null);
    setStatus("");
    if (target.kind === "story") {
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
      return;
    }
    if (target.kind === "new") {
      setDraft({
        type: target.type,
        name: "",
        aliases: "",
        summary: "",
        notes: "",
        sliders: {},
      });
      return;
    }
    if (entry) {
      setDraft({
        type: normalizeCodexType(entry.type),
        name: entry.name,
        aliases: entry.aliases ?? "",
        summary: entry.summary ?? "",
        notes: entry.notes ?? "",
        sliders: parseSliderMap(entry.slidersJson),
      });
    }
    // Sync when the opened target changes; live story fields are copied at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey]);

  useEffect(() => {
    if (target.kind !== "entry") {
      setAppearances([]);
      return;
    }
    void fetch(`/api/novels/${novelId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "listAppearances", payload: { entryId: target.entryId } }),
    })
      .then((r) => r.json())
      .then(setAppearances);
  }, [target, novelId]);

  const heading =
    target.kind === "story"
      ? story.title || "Story"
      : target.kind === "new"
        ? draft.name.trim() || "New entry"
        : draft.name.trim() || entry?.name || "Entry";

  const words = wordCount(target.kind === "story" ? storyDraft.premise : draft.summary);

  async function saveEntry(id?: string) {
    if (!draft.name.trim()) return;
    const res = await fetch(`/api/novels/${novelId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "upsertKnowledge",
        payload: {
          id,
          type: draft.type,
          name: draft.name.trim(),
          aliases: draft.aliases,
          summary: draft.summary,
          notes: draft.notes,
          slidersJson: JSON.stringify(draft.sliders),
        },
      }),
    });
    if (!res.ok) {
      setStatus("Could not save");
      return;
    }
    const saved = (await res.json()) as { id?: string };
    setStatus("Saved");
    if (!id && saved.id) onCreated(windowId, saved.id);
    onChange();
  }

  async function saveStory() {
    const res = await fetch(`/api/novels/${novelId}`, {
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
    if (!res.ok) {
      setStatus("Could not save");
      return;
    }
    setStatus("Saved");
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
      if (!res.ok) throw new Error(data.error || "Could not update summary");
      setProposed(data.proposedSummary);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Could not update summary");
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
    setDraft((d) => ({ ...d, summary: proposed }));
    setProposed(null);
    setStatus("Saved");
    onChange();
  }

  async function removeEntry() {
    if (!entry) return;
    if (!confirm(`Delete “${entry.name}” from the Codex?`)) return;
    await fetch(`/api/novels/${novelId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "deleteKnowledge", payload: { entryId: entry.id } }),
    });
    onDeleted(entry.id);
    onChange();
  }

  function onKeyDown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === "s") {
      e.preventDefault();
      if (target.kind === "story") void saveStory();
      else void saveEntry(entry?.id);
    }
  }

  const typeForGlyph: CodexType | "story" = target.kind === "story" ? "story" : draft.type;
  const mentionCount = appearances.length;

  const tabs = useMemo(() => {
    if (target.kind === "story") return [{ id: "details" as const, label: "Details" }];
    return [
      { id: "details" as const, label: "Details" },
      { id: "mentions" as const, label: mentionCount ? `Mentions (${mentionCount})` : "Mentions" },
    ];
  }, [target.kind, mentionCount]);

  return (
    <div className="flex h-full min-h-0 flex-col" onKeyDown={onKeyDown}>
      <div className="shrink-0 border-b border-border px-4 pt-3 pb-2">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            {target.kind === "story" ? (
              <>
                <p className="text-xs text-muted">Story</p>
                <p className="mt-1 font-serif text-2xl leading-tight">{heading}</p>
              </>
            ) : (
              <>
                <label className="block">
                  <span className="sr-only">Type</span>
                  <select
                    className="bg-transparent text-xs text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    value={draft.type}
                    onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value as CodexType }))}
                  >
                    {CODEX_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {CODEX_TYPE_SINGULAR[t]}
                      </option>
                    ))}
                  </select>
                </label>
                <input
                  className="mt-0.5 w-full bg-transparent font-serif text-2xl leading-tight placeholder:text-muted focus-visible:outline-none"
                  value={draft.name}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  placeholder="Name"
                />
              </>
            )}
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex h-14 w-14 items-center justify-center rounded-md border border-border bg-bg">
              <TypeGlyph type={typeForGlyph} name={heading} />
            </div>
            {target.kind === "entry" ? (
              <button
                type="button"
                className="text-[11px] text-muted hover:text-text"
                onClick={() => setTab("mentions")}
              >
                {mentionCount} {mentionCount === 1 ? "mention" : "mentions"}
              </button>
            ) : null}
          </div>
        </div>
        <div className="mt-3 flex gap-3" role="tablist" aria-label="Entry sections">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={`pb-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                tab === t.id
                  ? "border-b-2 border-accent text-text"
                  : "border-b-2 border-transparent text-muted hover:text-text"
              }`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-4 py-3 text-sm">
        {tab === "mentions" && target.kind !== "story" ? (
          <ul className="space-y-2">
            {appearances.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  className="w-full rounded-md border border-border bg-bg px-3 py-2 text-left text-xs hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  onClick={() => onJumpToProse(a.sceneId)}
                >
                  {a.contextSnippet}
                </button>
              </li>
            ))}
            {appearances.length === 0 ? (
              <li className="text-sm text-muted">None yet. Names are picked up when you save this chapter.</li>
            ) : null}
          </ul>
        ) : target.kind === "story" ? (
          <>
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
              <label key={key} className="mb-3 block text-xs text-muted">
                {label}
                <textarea
                  className="mt-1 w-full rounded-md border border-border bg-bg px-2 py-1.5 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  rows={key === "premise" || key === "notes" ? 4 : 2}
                  value={storyDraft[key]}
                  onChange={(e) => setStoryDraft((d) => ({ ...d, [key]: e.target.value }))}
                />
              </label>
            ))}
            <label className="mb-3 block text-xs text-muted">
              Style guide
              <textarea
                className="mt-1 w-full rounded-md border border-border bg-bg px-2 py-1.5 font-mono text-xs text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                rows={4}
                value={storyDraft.styleGuide}
                onChange={(e) => setStoryDraft((d) => ({ ...d, styleGuide: e.target.value }))}
              />
            </label>
          </>
        ) : (
          <>
            <label className="mb-3 block text-xs text-muted">
              Aliases
              <input
                className="mt-1 w-full rounded-md border border-border bg-bg px-2 py-1.5 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                value={draft.aliases}
                onChange={(e) => setDraft((d) => ({ ...d, aliases: e.target.value }))}
                placeholder="Add aliases, nicknames…"
              />
              <span className="mt-1 block text-[11px] text-muted">
                Names and aliases are detected in your prose.
              </span>
            </label>
            <label className="mb-1 block text-xs text-muted">Description</label>
            <textarea
              className="w-full rounded-md border border-border bg-bg px-2 py-1.5 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              rows={8}
              value={draft.summary}
              onChange={(e) => setDraft((d) => ({ ...d, summary: e.target.value }))}
            />
            <div className="mb-3 mt-1 flex items-center justify-between text-[11px] text-muted">
              <span>
                {words} {words === 1 ? "word" : "words"}
              </span>
            </div>
            <label className="mb-3 block text-xs text-muted">
              Notes
              <textarea
                className="mt-1 w-full rounded-md border border-border bg-bg px-2 py-1.5 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                rows={3}
                value={draft.notes}
                onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
              />
            </label>
            {draft.type === "character" ? (
              <div className="mb-3">
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
            {proposed ? (
              <div className="mb-3 rounded-md border border-border bg-bg p-2">
                <p className="text-xs text-muted">Proposed summary</p>
                <p className="mt-1 whitespace-pre-wrap">{proposed}</p>
                <button
                  type="button"
                  className="mt-2 rounded-md bg-accent px-2 py-1 text-xs text-bg"
                  onClick={() => void acceptSummary()}
                >
                  Accept
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2 border-t border-border px-4 py-2">
        <button
          type="button"
          className="rounded-md bg-accent px-3 py-1.5 text-xs text-bg disabled:opacity-50"
          onClick={() => (target.kind === "story" ? void saveStory() : void saveEntry(entry?.id))}
          disabled={target.kind !== "story" && !draft.name.trim()}
        >
          Save
        </button>
        {entry ? (
          <button
            type="button"
            disabled={busy}
            className="rounded-md border border-border px-3 py-1.5 text-xs text-muted hover:text-text disabled:opacity-50"
            onClick={() => void updateSummary()}
          >
            {busy ? "Updating…" : "Update summary"}
          </button>
        ) : null}
        {entry ? (
          <button
            type="button"
            className="ml-auto text-xs text-danger hover:underline"
            onClick={() => void removeEntry()}
          >
            Delete
          </button>
        ) : null}
        {status ? <p className={`text-xs text-accent ${entry ? "" : "ml-auto"}`}>{status}</p> : null}
      </div>
    </div>
  );
}
