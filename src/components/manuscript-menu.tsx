"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconBook, IconCaret, IconChevron, IconDoc, IconPlus } from "@/components/codex-icons";
import { entrySnippet } from "@/lib/codex-ui";
import { actLabel, chapterLabel, findChapterPlace } from "@/lib/manuscript";

export type ManuscriptChapter = {
  id: string;
  title: string;
  goal: string | null;
  summary: string | null;
  proseId: string | null;
};

export type ManuscriptAct = {
  id: string;
  title: string;
  chapters: ManuscriptChapter[];
};

export function ManuscriptMenu({
  acts,
  activeChapterId,
  onSelectChapter,
  onAddAct,
  onAddChapter,
  onMoveAct,
  onMoveChapter,
}: {
  acts: ManuscriptAct[];
  activeChapterId: string;
  onSelectChapter: (chapterId: string) => void;
  onAddAct: () => void;
  onAddChapter: (actId: string) => void;
  onMoveAct: (actIndex: number, dir: -1 | 1) => void;
  onMoveChapter: (actIndex: number, chapterIndex: number, dir: -1 | 1) => void;
}) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [pos, setPos] = useState({ top: 0, left: 0, maxHeight: 420 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const labelId = useId();

  const active = findChapterPlace(acts, activeChapterId);
  const triggerLabel = active
    ? `${actLabel(active.actIndex, active.act.title)} / ${chapterLabel(active.chapterIndex, active.chapter.title)}`
    : acts.length
      ? "Manuscript"
      : "Add act";

  function place() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = 320;
    const margin = 8;
    let left = rect.left;
    if (left + width > window.innerWidth - margin) {
      left = window.innerWidth - width - margin;
    }
    setPos({
      top: rect.bottom + 4,
      left: Math.max(margin, left),
      maxHeight: Math.max(240, window.innerHeight - rect.bottom - 16),
    });
  }

  useLayoutEffect(() => {
    if (!open) return;
    place();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    function onPointer(e: PointerEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onReposition() {
      place();
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open]);

  return (
    <div className="min-w-0">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? labelId : undefined}
        className="flex max-w-[10rem] items-center gap-1.5 rounded border border-border bg-surface px-2 py-1 text-left text-sm text-text hover:text-text sm:max-w-[14rem] lg:max-w-[18rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="min-w-0 flex-1 truncate">{triggerLabel}</span>
        <IconCaret className={`h-3.5 w-3.5 shrink-0 text-muted ${open ? "rotate-180" : ""}`} />
      </button>
      {open
        ? createPortal(
            <div
              ref={panelRef}
              id={labelId}
              role="dialog"
              aria-label="Manuscript"
              className="fixed z-50 flex w-80 flex-col overflow-hidden rounded-md border border-border bg-surface panel-enter"
              style={{ top: pos.top, left: pos.left, maxHeight: pos.maxHeight }}
            >
              <div className="flex items-center gap-2 border-b border-border px-3 py-2">
                <p className="min-w-0 flex-1 font-serif text-lg leading-none">Manuscript</p>
                <button
                  type="button"
                  className="flex shrink-0 items-center gap-1 rounded-md border border-border bg-bg px-2 py-1.5 text-xs hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  onClick={onAddAct}
                >
                  <IconPlus className="h-3.5 w-3.5" />
                  Add act
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-auto px-2 py-2">
                {acts.length === 0 ? (
                  <p className="px-2 py-3 text-sm text-muted">
                    Add an act to start drafting. Each chapter is one writing document.
                  </p>
                ) : (
                  acts.map((act, actIndex) => {
                    const expanded = !collapsed[act.id];
                    const actName = actLabel(actIndex, act.title);
                    return (
                      <section key={act.id} className={actIndex === 0 ? "" : "mt-2"}>
                        <div className="flex items-center gap-0.5 px-1">
                          <button
                            type="button"
                            aria-expanded={expanded}
                            className="flex min-w-0 flex-1 items-center gap-1 rounded px-1 py-1 text-left text-[11px] uppercase tracking-wide text-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                            onClick={() => setCollapsed((c) => ({ ...c, [act.id]: !c[act.id] }))}
                          >
                            <IconChevron className="h-3 w-3 shrink-0" open={expanded} />
                            <IconBook className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">
                              {actName} ({act.chapters.length})
                            </span>
                          </button>
                          <button
                            type="button"
                            aria-label={`Add chapter to ${actName}`}
                            className="rounded p-1 text-muted hover:bg-surface-2 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                            onClick={() => onAddChapter(act.id)}
                          >
                            <IconPlus className="h-3.5 w-3.5" />
                          </button>
                          <MovePair
                            label={actName}
                            canUp={actIndex > 0}
                            canDown={actIndex < acts.length - 1}
                            onUp={() => onMoveAct(actIndex, -1)}
                            onDown={() => onMoveAct(actIndex, 1)}
                          />
                        </div>
                        {expanded ? (
                          act.chapters.length === 0 ? (
                            <p className="px-2 py-1 text-xs text-muted">None yet</p>
                          ) : (
                            act.chapters.map((ch, chapterIndex) => {
                              const selected = ch.id === activeChapterId;
                              const chName = chapterLabel(chapterIndex, ch.title);
                              const snippet =
                                ch.goal || ch.summary ? entrySnippet(ch.goal, ch.summary) : "";
                              return (
                                <div key={ch.id} className="flex items-start gap-0.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onSelectChapter(ch.id);
                                      setOpen(false);
                                    }}
                                    className={`mb-0.5 flex min-w-0 flex-1 items-start gap-2 rounded-md px-2 py-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset ${
                                      selected ? "bg-accent-soft ring-1 ring-accent/40" : "hover:bg-surface-2"
                                    }`}
                                  >
                                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-bg text-muted">
                                      <IconDoc className="h-4 w-4" />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                      <span className={`block truncate text-sm ${selected ? "text-accent" : ""}`}>
                                        {chName}
                                      </span>
                                      {snippet ? (
                                        <span className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted">
                                          {snippet}
                                        </span>
                                      ) : null}
                                    </span>
                                  </button>
                                  <MovePair
                                    label={chName}
                                    canUp={chapterIndex > 0 || actIndex > 0}
                                    canDown={
                                      chapterIndex < act.chapters.length - 1 || actIndex < acts.length - 1
                                    }
                                    onUp={() => onMoveChapter(actIndex, chapterIndex, -1)}
                                    onDown={() => onMoveChapter(actIndex, chapterIndex, 1)}
                                  />
                                </div>
                              );
                            })
                          )
                        ) : null}
                      </section>
                    );
                  })
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function MovePair({
  label,
  canUp,
  canDown,
  onUp,
  onDown,
}: {
  label: string;
  canUp: boolean;
  canDown: boolean;
  onUp: () => void;
  onDown: () => void;
}) {
  return (
    <span className="flex shrink-0 flex-col">
      <button
        type="button"
        aria-label={`Move ${label} up`}
        disabled={!canUp}
        className="rounded p-0.5 text-muted hover:bg-surface-2 hover:text-text disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        onClick={onUp}
      >
        <IconCaret className="h-3 w-3" dir="up" />
      </button>
      <button
        type="button"
        aria-label={`Move ${label} down`}
        disabled={!canDown}
        className="rounded p-0.5 text-muted hover:bg-surface-2 hover:text-text disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        onClick={onDown}
      >
        <IconCaret className="h-3 w-3" />
      </button>
    </span>
  );
}
