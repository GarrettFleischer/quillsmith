"use client";

import { useState } from "react";
import { actName, chapterName } from "@/lib/manuscript";

export function ChapterHeading({
  novelId,
  actId,
  actIndex,
  actTitle,
  chapterId,
  chapterIndex,
  chapterTitle,
  chapterGoal,
  wordCount,
  saveLabel,
  onChange,
}: {
  novelId: string;
  actId: string;
  actIndex: number;
  actTitle: string;
  chapterId: string;
  chapterIndex: number;
  chapterTitle: string;
  chapterGoal: string | null;
  wordCount: number;
  saveLabel: string;
  onChange: () => void;
}) {
  const [actDraft, setActDraft] = useState(actName(actTitle));
  const [titleDraft, setTitleDraft] = useState(chapterName(chapterTitle));
  const [goalDraft, setGoalDraft] = useState(chapterGoal ?? "");

  async function saveAct() {
    const next = actDraft.trim();
    if (next === actName(actTitle)) return;
    await fetch(`/api/novels/${novelId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "upsertAct", payload: { id: actId, title: next } }),
    });
    onChange();
  }

  async function saveTitle() {
    const next = titleDraft.trim();
    if (next === chapterName(chapterTitle)) return;
    await fetch(`/api/novels/${novelId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "upsertChapter",
        payload: { id: chapterId, title: next },
      }),
    });
    onChange();
  }

  async function saveGoal() {
    const next = goalDraft.trim();
    if (next === (chapterGoal ?? "").trim()) return;
    await fetch(`/api/novels/${novelId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "upsertChapter",
        payload: { id: chapterId, goal: next },
      }),
    });
    onChange();
  }

  return (
    <header className="mb-6 border-b border-border pb-4">
      <div className="flex items-baseline gap-2">
        <span className="shrink-0 text-xs uppercase tracking-wide text-muted">
          Act {actIndex + 1}
        </span>
        <label className="min-w-0 flex-1">
          <span className="sr-only">Act name</span>
          <input
            className="w-full bg-transparent text-xs uppercase tracking-wide text-muted placeholder:text-muted/80 outline-none focus-visible:ring-0"
            value={actDraft}
            onChange={(e) => setActDraft(e.target.value)}
            onBlur={() => void saveAct()}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            placeholder="Name"
          />
        </label>
      </div>
      <label className="mt-1 block">
        <span className="sr-only">Chapter title</span>
        <input
          className="w-full bg-transparent font-display text-4xl leading-tight tracking-tight placeholder:text-muted outline-none focus-visible:ring-0"
          value={titleDraft}
          onChange={(e) => setTitleDraft(e.target.value)}
          onBlur={() => void saveTitle()}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          placeholder={`Chapter ${chapterIndex + 1}`}
        />
      </label>
      <label className="mt-3 block">
        <span className="sr-only">Chapter goal</span>
        <input
          className="w-full max-w-prose bg-transparent text-sm italic text-muted placeholder:text-muted/80 outline-none focus-visible:ring-0"
          value={goalDraft}
          onChange={(e) => setGoalDraft(e.target.value)}
          onBlur={() => void saveGoal()}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          placeholder="What this chapter must do"
        />
      </label>
      <p className="mt-3 text-xs text-muted" aria-live="polite">
        Chapter {chapterIndex + 1}
        {` · ${wordCount} ${wordCount === 1 ? "word" : "words"}`}
        {saveLabel ? ` · ${saveLabel}` : ""}
      </p>
    </header>
  );
}
