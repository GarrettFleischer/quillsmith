"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { useEditorStore } from "@/store/editor";
import { useWorkspaceStore } from "@/store/workspace";
import { applyHunkDecisions, buildRewriteHunks, type DiffHunk } from "@/lib/diff";
import { wordCount } from "@/lib/codex-ui";
import { tipTapFromPlain, plainFromTipTap } from "@/lib/utils";

export type DraftResult = {
  text: string;
  apply: "append" | "replace";
  source?: string;
};

export function ChapterEditor({
  novelId,
  proseId,
  chapterId,
  actId,
  initialContent,
  hasApiKey = true,
  draftResult,
  onDraftHandled,
  onSaved,
  onMeta,
}: {
  novelId: string;
  proseId: string;
  chapterId: string;
  actId: string;
  initialContent: string;
  hasApiKey?: boolean;
  draftResult?: DraftResult | null;
  onDraftHandled?: () => void;
  onSaved: () => void;
  onMeta?: (meta: { words: number; saveLabel: string }) => void;
}) {
  const setActive = useEditorStore((s) => s.setActive);
  const setStatus = useEditorStore((s) => s.setStatus);
  const sendSelectionToChat = useWorkspaceStore((s) => s.sendSelectionToChat);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onMetaRef = useRef(onMeta);
  const [error, setError] = useState("");
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

  useEffect(() => {
    onMetaRef.current = onMeta;
  }, [onMeta]);

  const persist = useCallback(
    async (json: string, source = "manual") => {
      onMetaRef.current?.({ words: wordCount(plainFromTipTap(json)), saveLabel: "Saving" });
      try {
        const res = await fetch(`/api/novels/${novelId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "saveScene",
            payload: { sceneId: proseId, content: json, source, scanMentions: true },
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Save failed" }));
          setError(err.error || "Save failed");
          setStatus("Save failed");
          onMetaRef.current?.({ words: wordCount(plainFromTipTap(json)), saveLabel: "Save failed" });
          return;
        }
        setError("");
        onMetaRef.current?.({ words: wordCount(plainFromTipTap(json)), saveLabel: "Saved" });
        onSaved();
      } catch {
        setError("Save failed");
        setStatus("Save failed");
        onMetaRef.current?.({ words: wordCount(plainFromTipTap(json)), saveLabel: "Save failed" });
      }
    },
    [novelId, proseId, onSaved, setStatus],
  );

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: "Write this chapter…",
      }),
    ],
    content: contentJson,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "manuscript min-h-[24rem]",
      },
    },
    onUpdate: ({ editor: ed }) => {
      const json = JSON.stringify(ed.getJSON());
      onMetaRef.current?.({ words: wordCount(plainFromTipTap(json)), saveLabel: "Editing" });
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void persist(json);
      }, 900);
    },
    onSelectionUpdate: () => setActive({ chapterId, sceneId: proseId, actId }),
    onFocus: () => setActive({ chapterId, sceneId: proseId, actId }),
  });

  useEffect(() => {
    onMetaRef.current?.({ words: wordCount(plainFromTipTap(initialContent)), saveLabel: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proseId]);

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
  }, [proseId, editor]);

  useEffect(() => {
    if (!editor || !draftResult?.text.trim()) return;
    const originalPlain = plainFromTipTap(JSON.stringify(editor.getJSON()));
    if (draftResult.apply === "append") {
      const next = `${originalPlain.trim()}\n\n${draftResult.text.trim()}`.trim();
      const json = tipTapFromPlain(next);
      editor.commands.setContent(JSON.parse(json));
      void persist(json, draftResult.source ?? "expand");
      setHunks(null);
    } else {
      setPreRewrite(originalPlain);
      setHunks(buildRewriteHunks(originalPlain, draftResult.text.trim()));
    }
    onDraftHandled?.();
  }, [draftResult, editor, persist, onDraftHandled]);

  async function loadRevisions() {
    const res = await fetch(`/api/novels/${novelId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "listRevisions", payload: { sceneId: proseId } }),
    });
    if (!res.ok) {
      setError("Could not load revisions");
      return;
    }
    setRevisions(await res.json());
    setShowHistory(true);
  }

  async function restore(revisionId: string) {
    const res = await fetch(`/api/novels/${novelId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "restoreRevision",
        payload: { sceneId: proseId, revisionId },
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Restore failed" }));
      setError(err.error || "Restore failed");
      return;
    }
    const saved = (await res.json()) as { content?: string };
    if (editor && saved.content) {
      try {
        editor.commands.setContent(JSON.parse(saved.content));
      } catch {
        /* ignore */
      }
    }
    setShowHistory(false);
    onSaved();
  }

  async function applyHunks(next: DiffHunk[]) {
    if (!editor) return;
    const text = applyHunkDecisions(next);
    const json = tipTapFromPlain(text);
    editor.commands.setContent(JSON.parse(json));
    await persist(json, "rewrite");
    setHunks(null);
  }

  return (
    <section data-chapter-id={chapterId} data-scene-id={proseId} data-act-id={actId}>
      {editor && hasApiKey ? (
        <BubbleMenu
          editor={editor}
          className="selection-menu"
          shouldShow={({ state }) => {
            const { from, to, empty } = state.selection;
            if (empty) return false;
            return Boolean(state.doc.textBetween(from, to, " ").trim());
          }}
        >
          <button
            type="button"
            className="rounded-md bg-accent px-2 py-1 text-xs text-bg"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              const { from, to } = editor.state.selection;
              const text = editor.state.doc.textBetween(from, to, " ").trim();
              if (text) sendSelectionToChat(text);
            }}
          >
            Send to chat
          </button>
        </BubbleMenu>
      ) : null}

      <div className="mb-3 flex justify-end">
        <button
          type="button"
          className="text-xs text-muted underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          onClick={() => void loadRevisions()}
        >
          History
        </button>
      </div>

      <EditorContent editor={editor} />

      {error ? (
        <p className="mt-2 rounded-md border border-border bg-bg px-2 py-2 text-xs text-danger">
          {error}
        </p>
      ) : null}

      {hunks ? (
        <div className="mt-4 rounded-md border border-border bg-surface p-3 panel-enter">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium">Review rewrite</p>
            <button
              type="button"
              className="rounded-md bg-accent px-2 py-1 text-xs text-bg"
              onClick={() =>
                void applyHunks(
                  hunks.map((h) => (h.type === "equal" ? h : { ...h, accepted: "new" as const })),
                )
              }
            >
              Accept all
            </button>
            <button
              type="button"
              className="rounded-md border border-border px-2 py-1 text-xs"
              onClick={() => {
                setHunks(null);
                if (editor) {
                  editor.commands.setContent(JSON.parse(tipTapFromPlain(preRewrite)));
                }
              }}
            >
              Reject all
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
                      setHunks(
                        (prev) =>
                          prev?.map((x) => (x.id === h.id ? { ...x, accepted: "new" } : x)) ??
                          null,
                      )
                    }
                  >
                    {h.accepted === "new" ? h.revised || "∅" : h.original || "∅"}
                  </span>
                  {h.original ? (
                    <span
                      className="diff-original"
                      title="Keep original"
                      onClick={() =>
                        setHunks(
                          (prev) =>
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
            className="mt-3 rounded-md bg-accent px-3 py-1.5 text-sm text-bg"
            onClick={() => void applyHunks(hunks)}
          >
            Apply decisions
          </button>
          <p className="mt-1 text-xs text-muted">Undecided hunks keep the original text.</p>
        </div>
      ) : null}

      {showHistory ? (
        <div className="mt-3 rounded-md border border-border bg-surface p-3 text-sm panel-enter">
          <div className="mb-2 flex justify-between">
            <p className="font-medium">Revisions</p>
            <button type="button" className="text-xs text-muted" onClick={() => setShowHistory(false)}>
              Close
            </button>
          </div>
          <ul className="space-y-2">
            {revisions.length === 0 ? <li className="text-muted">No revisions yet.</li> : null}
            {revisions.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2">
                <span className="text-muted">
                  {r.source}
                  {r.label ? ` · ${r.label}` : ""} · {new Date(r.createdAt).toLocaleString()}
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
