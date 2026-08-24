"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { useEditorStore } from "@/store/editor";
import { tipTapFromPlain } from "@/lib/utils";
import type { DraftResult } from "@/components/chapter-editor";

export type Beat = { id: string; content: string; order: number; prose?: string | null };

const EMPTY_DOC = { type: "doc", content: [{ type: "paragraph" }] };

export function BeatManuscript({
  novelId,
  chapterId,
  actId,
  beats,
  model,
  hasApiKey = true,
  draftResult,
  onDraftHandled,
  onChange,
}: {
  novelId: string;
  chapterId: string;
  actId: string;
  beats: Beat[];
  model: string;
  hasApiKey?: boolean;
  draftResult?: DraftResult | null;
  onDraftHandled?: () => void;
  onChange: () => void;
}) {
  async function patch(action: string, payload: Record<string, unknown>) {
    await fetch(`/api/novels/${novelId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, payload }),
    });
  }

  const [genBeats, setGenBeats] = useState(false);
  const [genErr, setGenErr] = useState("");

  async function addBeat() {
    await patch("upsertBeat", { chapterId, content: "" });
    onChange();
  }

  async function generateBeats() {
    setGenBeats(true);
    setGenErr("");
    try {
      const res = await fetch("/api/ai/generate-beats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ novelId, chapterId }),
      });
      const data = await res.json().catch(() => ({ error: "Failed" }));
      if (!res.ok) throw new Error(data.error || "Failed to generate beats");
      onChange();
    } catch (e) {
      setGenErr(e instanceof Error ? e.message : "Failed to generate beats");
    } finally {
      setGenBeats(false);
    }
  }

  async function removeBeat(beatId: string) {
    if (beats.length <= 1) {
      // Keep at least one beat; just clear it instead of deleting the last one.
      await patch("upsertBeat", { id: beatId, chapterId, content: "" });
      await patch("saveBeatProse", { beatId, content: "" });
    } else {
      await patch("deleteBeat", { beatId });
    }
    onChange();
  }

  async function move(index: number, dir: -1 | 1) {
    const j = index + dir;
    if (j < 0 || j >= beats.length) return;
    const next = [...beats];
    [next[index], next[j]] = [next[j], next[index]];
    await patch("reorderBeats", { chapterId, orderedIds: next.map((b) => b.id) });
    onChange();
  }

  // Chat drafts land as prose: append → a new beat; replace → the last beat.
  useEffect(() => {
    if (!draftResult?.text.trim()) return;
    (async () => {
      const doc = tipTapFromPlain(draftResult.text.trim());
      if (draftResult.apply === "replace" && beats.length) {
        await patch("saveBeatProse", { beatId: beats[beats.length - 1].id, content: doc });
      } else {
        const created = (await (
          await fetch(`/api/novels/${novelId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "upsertBeat", payload: { chapterId, content: "" } }),
          })
        ).json()) as { id?: string };
        if (created.id) await patch("saveBeatProse", { beatId: created.id, content: doc });
      }
      onDraftHandled?.();
      onChange();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftResult]);

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted">
        Each beat is its own block: write the beat’s outline on the right, its prose on the left.
      </p>
      {beats.map((beat, i) => (
        <BeatBlock
          key={beat.id}
          novelId={novelId}
          chapterId={chapterId}
          actId={actId}
          beat={beat}
          index={i}
          total={beats.length}
          model={model}
          hasApiKey={hasApiKey}
          onMove={(dir) => void move(i, dir)}
          onRemove={() => void removeBeat(beat.id)}
          onChange={onChange}
        />
      ))}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="cursor-pointer rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted hover:border-accent hover:text-accent"
          onClick={() => void addBeat()}
        >
          + Add beat
        </button>
        <button
          type="button"
          disabled={!hasApiKey || genBeats}
          title={hasApiKey ? "Generate beat outlines from the chapter summary" : "Add an OpenRouter key in Settings"}
          className="cursor-pointer rounded-md border border-accent px-3 py-2 text-sm text-accent hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => void generateBeats()}
        >
          {genBeats ? "Generating beats…" : "Generate beats from summary"}
        </button>
      </div>
      {genErr ? <p className="text-xs text-danger">{genErr}</p> : null}
    </div>
  );
}

function BeatBlock({
  novelId,
  chapterId,
  actId,
  beat,
  index,
  total,
  model,
  hasApiKey,
  onMove,
  onRemove,
  onChange,
}: {
  novelId: string;
  chapterId: string;
  actId: string;
  beat: Beat;
  index: number;
  total: number;
  model: string;
  hasApiKey: boolean;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
  onChange: () => void;
}) {
  const setActive = useEditorStore((s) => s.setActive);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const outlineRef = useRef<HTMLTextAreaElement>(null);
  const [outline, setOutline] = useState(beat.content ?? "");
  const [writing, setWriting] = useState(false);
  const [error, setError] = useState("");

  // Grow the outline box to fit its text (no scrollbar); the flex row then
  // takes the height of whichever side — prose or outline — is taller.
  const autosize = useCallback(() => {
    const el = outlineRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useEffect(() => {
    autosize();
  }, [outline, autosize]);

  const initialContent = useMemo(() => {
    try {
      return beat.prose ? JSON.parse(beat.prose) : EMPTY_DOC;
    } catch {
      return EMPTY_DOC;
    }
  }, [beat.prose]);

  const persistProse = useCallback(
    async (json: string) => {
      await fetch(`/api/novels/${novelId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "saveBeatProse", payload: { beatId: beat.id, content: json } }),
      });
      onChange();
    },
    [novelId, beat.id, onChange],
  );

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Write this beat…" }),
    ],
    content: initialContent,
    immediatelyRender: false,
    editorProps: { attributes: { class: "manuscript min-h-[8rem]" } },
    onUpdate: ({ editor: ed }) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => void persistProse(JSON.stringify(ed.getJSON())), 900);
    },
    onFocus: () => setActive({ chapterId, sceneId: beat.id, actId }),
  });

  // Pull in externally-changed prose (e.g. after "Write with AI").
  useEffect(() => {
    if (!editor) return;
    const current = JSON.stringify(editor.getJSON());
    const incoming = beat.prose || JSON.stringify(EMPTY_DOC);
    if (current !== incoming) {
      try {
        editor.commands.setContent(JSON.parse(incoming));
      } catch {
        /* ignore */
      }
    }
  }, [beat.prose, editor]);

  async function saveOutline(next: string) {
    await fetch(`/api/novels/${novelId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "upsertBeat", payload: { id: beat.id, chapterId, content: next } }),
    });
    onChange();
  }

  async function writeWithAI() {
    if (!hasApiKey || !editor) return;
    setWriting(true);
    setError("");
    try {
      const res = await fetch("/api/ai/write-beat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ novelId, chapterId, beatId: beat.id, model }),
      });
      const data = await res.json().catch(() => ({ error: "Failed" }));
      if (!res.ok) throw new Error(data.error || "Write failed");
      const text = String(data.text || "").trim();
      if (text) {
        const json = tipTapFromPlain(text);
        editor.commands.setContent(JSON.parse(json));
        await persistProse(json);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Write failed");
    } finally {
      setWriting(false);
    }
  }

  return (
    <div className="flex gap-3 rounded-lg border border-border bg-surface/40 p-3">
      <div className="min-w-0 flex-1">
        <EditorContent editor={editor} />
        {error ? <p className="mt-1 text-xs text-danger">{error}</p> : null}
      </div>
      <div className="flex w-[240px] shrink-0 flex-col gap-2 border-l border-border pl-3">
        <div className="flex items-center justify-between text-xs text-muted">
          <span className="uppercase tracking-wide">Beat {index + 1}</span>
          <span className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Move beat up"
              disabled={index === 0}
              className="cursor-pointer rounded px-1 hover:text-text disabled:cursor-not-allowed disabled:opacity-30"
              onClick={() => onMove(-1)}
            >
              ↑
            </button>
            <button
              type="button"
              aria-label="Move beat down"
              disabled={index === total - 1}
              className="cursor-pointer rounded px-1 hover:text-text disabled:cursor-not-allowed disabled:opacity-30"
              onClick={() => onMove(1)}
            >
              ↓
            </button>
            <button
              type="button"
              aria-label="Delete beat"
              className="cursor-pointer rounded px-1 text-danger hover:underline"
              onClick={onRemove}
            >
              ✕
            </button>
          </span>
        </div>
        <textarea
          ref={outlineRef}
          rows={4}
          className="min-h-[8rem] w-full resize-none overflow-hidden rounded-md border border-border bg-bg px-2 py-1.5 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-accent"
          placeholder="What happens in this beat…"
          value={outline}
          onChange={(e) => {
            setOutline(e.target.value);
            autosize();
          }}
          onBlur={(e) => {
            if (e.target.value !== (beat.content ?? "")) void saveOutline(e.target.value);
          }}
        />
        <button
          type="button"
          disabled={!hasApiKey || writing || !outline.trim()}
          title={
            !hasApiKey
              ? "Add an OpenRouter key in Settings"
              : !outline.trim()
                ? "Write a beat outline first"
                : "Write this beat's prose from its outline"
          }
          className="cursor-pointer rounded-md border border-accent px-2 py-1 text-xs text-accent hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => void writeWithAI()}
        >
          {writing ? "Writing…" : "Write with AI"}
        </button>
      </div>
    </div>
  );
}
