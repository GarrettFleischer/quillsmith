"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import type { DiffHunk } from "@/lib/diff";
import { applyHunkDecisions, buildRewriteHunks } from "@/lib/diff";
import { tipTapFromPlain, plainFromTipTap } from "@/lib/utils";
import { useEditorStore } from "@/store/editor";

type Command = { slug: string; label: string; description: string | null };

export function SceneEditor({
  novelId,
  sceneId,
  chapterId,
  actId,
  initialContent,
  title,
  commands,
  model,
  onSaved,
}: {
  novelId: string;
  sceneId: string;
  chapterId: string;
  actId: string;
  initialContent: string;
  title: string;
  commands: Command[];
  model: string;
  onSaved: () => void;
}) {
  const setActive = useEditorStore((s) => s.setActive);
  const setStatus = useEditorStore((s) => s.setStatus);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [slashOpen, setSlashOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [activeCommand, setActiveCommand] = useState<Command | null>(null);
  const [streaming, setStreaming] = useState("");
  const [busy, setBusy] = useState(false);
  const [hunks, setHunks] = useState<DiffHunk[] | null>(null);
  const [preRewrite, setPreRewrite] = useState("");
  const [revisions, setRevisions] = useState<
    Array<{ id: string; source: string; label: string | null; createdAt: string }>
  >([]);
  const [showHistory, setShowHistory] = useState(false);

  const contentJson = useMemo(() => {
    try {
      return JSON.parse(initialContent);
    } catch {
      return { type: "doc", content: [{ type: "paragraph" }] };
    }
  }, [initialContent]);

  const persist = useCallback(
    async (json: string, source = "manual") => {
      await fetch(`/api/novels/${novelId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "saveScene",
          payload: { sceneId, content: json, source, scanMentions: true },
        }),
      });
      onSaved();
    },
    [novelId, sceneId, onSaved],
  );

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Write the scene… or type / for AI" }),
    ],
    content: contentJson,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "manuscript min-h-[12rem]",
      },
      handleKeyDown: (_view, event) => {
        if (event.key === "/" && !event.metaKey && !event.ctrlKey) {
          const { state } = _view;
          const $from = state.selection.$from;
          const textBefore = $from.parent.textBetween(0, $from.parentOffset, undefined, "\ufffc");
          if (textBefore === "" || textBefore.endsWith(" ") || textBefore.endsWith("\n")) {
            setSlashOpen(true);
          }
        }
        return false;
      },
    },
    onUpdate: ({ editor: ed }) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void persist(JSON.stringify(ed.getJSON()));
      }, 900);
    },
    onSelectionUpdate: () => {
      setActive({ chapterId, sceneId, actId });
    },
    onFocus: () => setActive({ chapterId, sceneId, actId }),
  });

  useEffect(() => {
    if (!editor) return;
    const current = JSON.stringify(editor.getJSON());
    if (current !== initialContent) {
      try {
        editor.commands.setContent(JSON.parse(initialContent));
      } catch {
        /* ignore */
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneId]);

  async function loadRevisions() {
    const res = await fetch(`/api/novels/${novelId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "listRevisions", payload: { sceneId } }),
    });
    setRevisions(await res.json());
    setShowHistory(true);
  }

  async function restore(revisionId: string) {
    await fetch(`/api/novels/${novelId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "restoreRevision",
        payload: { sceneId, revisionId },
      }),
    });
    setShowHistory(false);
    onSaved();
  }

  async function runCommand() {
    if (!activeCommand || !editor) return;
    setBusy(true);
    setStreaming("");
    setHunks(null);
    setStatus("Generating…");
    const originalPlain = plainFromTipTap(JSON.stringify(editor.getJSON()));
    setPreRewrite(originalPlain);

    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commandSlug: activeCommand.slug,
          novelId,
          sceneId,
          instruction,
          model,
        }),
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: "Failed" }));
        throw new Error(err.error || "Generation failed");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let full = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data:")) continue;
          const event = JSON.parse(line.slice(5).trim()) as {
            type: string;
            text?: string;
            message?: string;
            name?: string;
          };
          if (event.type === "token" && event.text) {
            full += event.text;
            setStreaming(full);
          }
          if (event.type === "status" && event.message) setStatus(event.message);
          if (event.type === "tool" && event.name) setStatus(`Looking up… (${event.name})`);
          if (event.type === "error") throw new Error(event.message);
          if (event.type === "done") full = event.text || full;
        }
      }

      if (activeCommand.slug === "expand") {
        const next = `${originalPlain.trim()}\n\n${full.trim()}`.trim();
        const json = tipTapFromPlain(next);
        editor.commands.setContent(JSON.parse(json));
        await persist(json, "expand");
        setActiveCommand(null);
        setInstruction("");
        setStreaming("");
      } else {
        setHunks(buildRewriteHunks(originalPlain, full.trim()));
      }
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
      setStatus("");
    }
  }

  async function applyHunks(next: DiffHunk[]) {
    if (!editor) return;
    const text = applyHunkDecisions(next);
    const json = tipTapFromPlain(text);
    editor.commands.setContent(JSON.parse(json));
    await persist(json, "rewrite");
    setHunks(null);
    setStreaming("");
    setActiveCommand(null);
    setInstruction("");
  }

  return (
    <section
      className="scroll-mt-20 border-b border-border/70 py-8"
      data-scene-id={sceneId}
      data-chapter-id={chapterId}
      data-act-id={actId}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-serif text-xl text-muted">{title || "Scene"}</h3>
        <button
          type="button"
          className="text-xs text-muted underline-offset-2 hover:underline"
          onClick={() => void loadRevisions()}
        >
          History
        </button>
      </div>

      <EditorContent editor={editor} />

      {slashOpen && !activeCommand ? (
        <div className="mt-3 rounded-md border border-border bg-surface p-2 shadow panel-enter">
          <p className="px-2 pb-1 text-xs uppercase tracking-wide text-muted">Commands</p>
          {commands.map((c) => (
            <button
              key={c.slug}
              type="button"
              className="block w-full rounded px-2 py-2 text-left hover:bg-accent-soft"
              onClick={() => {
                setActiveCommand(c);
                setSlashOpen(false);
              }}
            >
              <span className="font-medium">/{c.slug}</span>
              <span className="ml-2 text-sm text-muted">{c.description}</span>
            </button>
          ))}
          <button
            type="button"
            className="mt-1 px-2 text-xs text-muted"
            onClick={() => setSlashOpen(false)}
          >
            Cancel
          </button>
        </div>
      ) : null}

      {activeCommand && !hunks ? (
        <div className="mt-3 rounded-md border border-border bg-surface p-3 panel-enter">
          <p className="text-sm font-medium">/{activeCommand.slug}</p>
          <textarea
            className="mt-2 w-full rounded border border-border bg-bg px-2 py-2 text-sm outline-none"
            rows={3}
            placeholder={
              activeCommand.slug === "rewrite"
                ? 'Target length, e.g. "400 words" or "cut by about a third"'
                : 'Optional notes, e.g. "600 words" or "stay in Elena\'s POV"'
            }
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
          />
          {streaming ? (
            <div className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-bg p-2 text-sm text-muted">
              {streaming}
            </div>
          ) : null}
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={busy}
              className="rounded bg-accent px-3 py-1.5 text-sm text-bg disabled:opacity-50"
              onClick={() => void runCommand()}
            >
              {busy ? "Working…" : "Run"}
            </button>
            <button
              type="button"
              className="rounded border border-border px-3 py-1.5 text-sm"
              onClick={() => {
                setActiveCommand(null);
                setStreaming("");
              }}
            >
              Discard
            </button>
          </div>
        </div>
      ) : null}

      {hunks ? (
        <div className="mt-4 rounded-md border border-border bg-surface p-3 panel-enter">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium">Review rewrite</p>
            <button
              type="button"
              className="rounded bg-accent px-2 py-1 text-xs text-bg"
              onClick={() =>
                void applyHunks(
                  hunks.map((h) =>
                    h.type === "equal" ? h : { ...h, accepted: "new" as const },
                  ),
                )
              }
            >
              Accept all
            </button>
            <button
              type="button"
              className="rounded border border-border px-2 py-1 text-xs"
              onClick={() => {
                setHunks(null);
                setStreaming("");
                if (editor) {
                  editor.commands.setContent(JSON.parse(tipTapFromPlain(preRewrite)));
                }
              }}
            >
              Reject all
            </button>
            <button
              type="button"
              className="rounded border border-border px-2 py-1 text-xs"
              onClick={() => {
                setHunks(null);
                void runCommand();
              }}
            >
              Retry
            </button>
          </div>
          <div className="manuscript space-y-1 text-base">
            {hunks.map((h) =>
              h.type === "equal" ? (
                <span key={h.id}>{h.revised}</span>
              ) : (
                <span key={h.id} className="inline-block align-top">
                  <span
                    className="diff-new"
                    title="Accept new"
                    onClick={() =>
                      setHunks((prev) =>
                        prev?.map((x) =>
                          x.id === h.id ? { ...x, accepted: "new" } : x,
                        ) ?? null,
                      )
                    }
                  >
                    {h.accepted === "original" ? h.original : h.revised || "∅"}
                  </span>
                  {h.original ? (
                    <span
                      className="diff-original"
                      title="Keep original"
                      onClick={() =>
                        setHunks((prev) =>
                          prev?.map((x) =>
                            x.id === h.id ? { ...x, accepted: "original" } : x,
                          ) ?? null,
                        )
                      }
                    >
                      {h.original}
                    </span>
                  ) : null}
                </span>
              ),
            )}
          </div>
          <button
            type="button"
            className="mt-3 rounded bg-accent px-3 py-1.5 text-sm text-bg"
            onClick={() => void applyHunks(hunks)}
          >
            Apply decisions
          </button>
        </div>
      ) : null}

      {showHistory ? (
        <div className="mt-3 rounded border border-border bg-surface p-3 text-sm">
          <div className="mb-2 flex justify-between">
            <p className="font-medium">Revisions</p>
            <button type="button" onClick={() => setShowHistory(false)}>
              Close
            </button>
          </div>
          <ul className="space-y-2">
            {revisions.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2">
                <span className="text-muted">
                  {r.source}
                  {r.label ? ` · ${r.label}` : ""} ·{" "}
                  {new Date(r.createdAt).toLocaleString()}
                </span>
                <button
                  type="button"
                  className="text-accent underline-offset-2 hover:underline"
                  onClick={() => void restore(r.id)}
                >
                  Restore
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
