"use client";

import { useMemo, useState } from "react";
import {
  IconChevron,
  IconDoc,
  IconItem,
  IconMapPin,
  IconPlus,
  IconScroll,
  IconSearch,
  IconSpark,
  IconStory,
} from "@/components/codex-icons";
import { CodexExtractModal } from "@/components/codex-extract-modal";
import { LeftRailTabs } from "@/components/left-rail-tabs";
import { CODEX_TYPE_PLURAL, CODEX_TYPES, entrySnippet, normalizeCodexType, type CodexType } from "@/lib/codex-ui";
import { type CodexTarget, useWorkspaceStore } from "@/store/workspace";

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

function TypeMark({ type, name }: { type: CodexType | "story"; name: string }) {
  const box = "flex h-8 w-8 shrink-0 items-center justify-center text-muted";
  if (type === "character") {
    const initial = (name.trim()[0] || "?").toUpperCase();
    return (
      <span className={`${box} rounded-full border border-border bg-bg text-xs font-medium`}>
        {initial}
      </span>
    );
  }
  const inner = "h-4 w-4";
  return (
    <span className={`${box} rounded-md border border-border bg-bg`}>
      {type === "story" ? (
        <IconStory className={inner} />
      ) : type === "location" ? (
        <IconMapPin className={inner} />
      ) : type === "lore" ? (
        <IconScroll className={inner} />
      ) : type === "item" ? (
        <IconItem className={inner} />
      ) : (
        <IconDoc className={inner} />
      )}
    </span>
  );
}

function EntryRow({
  markType,
  name,
  snippet,
  active,
  onOpen,
}: {
  markType: CodexType | "story";
  name: string;
  snippet: string;
  active: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`mb-0.5 flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset ${
        active ? "bg-accent-soft ring-1 ring-accent/40" : "hover:bg-surface-2"
      }`}
    >
      <TypeMark type={markType} name={name} />
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-sm ${active ? "text-accent" : ""}`}>{name}</span>
        <span className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted">{snippet}</span>
      </span>
    </button>
  );
}

export function KnowledgeSidebar({
  novelId,
  entries,
  story,
  onChange,
  onCollapse,
  className,
}: {
  novelId: string;
  entries: KnowledgeEntry[];
  story: StoryFields;
  onChange?: () => void;
  onCollapse?: () => void;
  className?: string;
}) {
  const [filter, setFilter] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [extractOpen, setExtractOpen] = useState(false);
  const openCodexWindow = useWorkspaceStore((s) => s.openCodexWindow);
  const windows = useWorkspaceStore((s) => s.windows);
  const focusedId = useWorkspaceStore((s) => s.focusedWindowId);

  const activeTarget = windows.find((w) => w.id === focusedId)?.target ?? windows[0]?.target ?? null;

  function isActive(target: CodexTarget) {
    if (!activeTarget) return false;
    if (target.kind !== activeTarget.kind) return false;
    if (target.kind === "story") return true;
    if (target.kind === "entry" && activeTarget.kind === "entry") return target.entryId === activeTarget.entryId;
    return false;
  }

  const q = filter.trim().toLowerCase();
  const filtered = entries.filter(
    (e) =>
      !q ||
      e.name.toLowerCase().includes(q) ||
      (e.aliases ?? "").toLowerCase().includes(q) ||
      (e.summary ?? "").toLowerCase().includes(q) ||
      e.type.toLowerCase().includes(q),
  );
  const grouped = useMemo(() => {
    const map = new Map<CodexType, KnowledgeEntry[]>();
    for (const t of CODEX_TYPES) map.set(t, []);
    for (const e of filtered) {
      const key = normalizeCodexType(e.type);
      map.set(key, [...(map.get(key) ?? []), e]);
    }
    return map;
  }, [filtered]);

  const storyVisible =
    !q ||
    "story".includes(q) ||
    story.title.toLowerCase().includes(q) ||
    (story.premise ?? "").toLowerCase().includes(q);

  function toggleGroup(type: CodexType) {
    setCollapsed((c) => ({ ...c, [type]: !c[type] }));
  }

  return (
    <aside
      className={`flex h-full min-h-0 w-[300px] shrink-0 flex-col border-r border-border bg-surface/70 panel-enter ${className ?? ""}`}
    >
      <LeftRailTabs onCollapse={onCollapse} />
      <div className="border-b border-border px-3 py-2">
        <div className="flex items-center gap-1.5">
          <div className="relative min-w-0 flex-1">
            <IconSearch className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
            <input
              className="w-full rounded-md border border-border bg-bg py-1.5 pr-2 pl-7 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              placeholder="Search all entries…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="flex shrink-0 cursor-pointer items-center gap-1 rounded-md border border-border bg-bg px-2 py-1.5 text-xs hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            onClick={() => openCodexWindow({ kind: "new", type: "character" })}
          >
            <IconPlus className="h-3.5 w-3.5" />
            New Entry
          </button>
        </div>
        <button
          type="button"
          className="mt-2 inline-flex cursor-pointer items-center gap-1 text-xs text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          onClick={() => setExtractOpen(true)}
        >
          <IconSpark className="h-3.5 w-3.5" />
          Extract from summaries &amp; beats
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-2 py-2">
        {storyVisible ? (
          <EntryRow
            markType="story"
            name={story.title || "Story"}
            snippet={entrySnippet(story.premise, story.notes)}
            active={isActive({ kind: "story" })}
            onOpen={() => openCodexWindow({ kind: "story" })}
          />
        ) : null}
        {CODEX_TYPES.map((type) => {
          const rows = grouped.get(type) ?? [];
          if (q && rows.length === 0) return null;
          const open = !collapsed[type];
          return (
            <section key={type} className="mt-2">
              <div className="flex items-center gap-1 px-1">
                <button
                  type="button"
                  aria-expanded={open}
                  className="flex min-w-0 flex-1 items-center gap-1 rounded px-1 py-1 text-left text-xs uppercase tracking-wide text-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  onClick={() => toggleGroup(type)}
                >
                  <IconChevron className="h-3 w-3" open={open} />
                  <span className="truncate">
                    {CODEX_TYPE_PLURAL[type]} ({rows.length})
                  </span>
                </button>
                <button
                  type="button"
                  aria-label={`Add ${CODEX_TYPE_PLURAL[type].toLowerCase()}`}
                  className="rounded p-1 text-muted hover:bg-surface-2 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  onClick={() => openCodexWindow({ kind: "new", type })}
                >
                  <IconPlus className="h-3.5 w-3.5" />
                </button>
              </div>
              {open ? (
                rows.length === 0 ? (
                  <p className="px-2 py-1 text-xs text-muted">None yet</p>
                ) : (
                  rows.map((e) => (
                    <EntryRow
                      key={e.id}
                      markType={normalizeCodexType(e.type)}
                      name={e.name}
                      snippet={entrySnippet(e.summary, e.notes)}
                      active={isActive({ kind: "entry", entryId: e.id })}
                      onOpen={() => openCodexWindow({ kind: "entry", entryId: e.id })}
                    />
                  ))
                )
              ) : null}
            </section>
          );
        })}
      </div>
      {extractOpen ? (
        <CodexExtractModal
          novelId={novelId}
          onClose={() => setExtractOpen(false)}
          onSaved={() => onChange?.()}
        />
      ) : null}
    </aside>
  );
}
