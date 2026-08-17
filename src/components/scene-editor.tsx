"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { AgentTracePanel } from "@/components/agent-trace-panel";
import type { DiffHunk } from "@/lib/diff";
import { applyHunkDecisions, buildRewriteHunks } from "@/lib/diff";
import {
  consumeAgentStream,
  stopAgentRun,
  type ToolTraceEntry,
} from "@/lib/agent-stream-client";
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
  hasApiKey = true,
  isActive = false,
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
  hasApiKey?: boolean;
  isActive?: boolean;
  onSaved: () => void;
}) {
  const setActive = useEditorStore((s) => s.setActive);
  const setStatus = useEditorStore((s) => s.setStatus);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runIdRef = useRef<string | null>(null);
  const traceRef = useRef<{ thinking: string; tools: ToolTraceEntry[] }>({
    thinking: "",
    tools: [],
  });
  const discardedRef = useRef(false);
  const [sceneTitle, setSceneTitle] = useState(title || "Scene");
  const [slashOpen, setSlashOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [activeCommand, setActiveCommand] = useState<Command | null>(null);
  const [streaming, setStreaming] = useState("");
  const [feedbackText, setFeedbackText] = useState("");
  const [busy, setBusy] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);
  const [trace, setTrace] = useState<{ thinking: string; tools: ToolTraceEntry[] }>({
    thinking: "",
    tools: [],
  });
  const [lastTrace, setLastTrace] = useState<{
    thinking: string;
    tools: ToolTraceEntry[];
  } | null>(null);
  const [traceCollapsed, setTraceCollapsed] = useState(true);
  const [error, setError] = useState("");
  const [hunks, setHunks] = useState<DiffHunk[] | null>(null);
  const [preRewrite, setPreRewrite] = useState("");
  const [lastPlan, setLastPlan] = useState("");
  const [revisions, setRevisions] = useState<
    Array<{ id: string; source: string; label: string | null; createdAt: string }>
  >([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    setSceneTitle(title || "Scene");
  }, [title, sceneId]);

  const contentJson = useMemo(() => {
    try {
      return JSON.parse(initialContent);
    } catch {
      return { type: "doc", content: [{ type: "paragraph" }] };
    }
  }, [initialContent]);

  const persist = useCallback(
    async (json: string, source = "manual") => {
      try {
        const res = await fetch(`/api/novels/${novelId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "saveScene",
            payload: { sceneId, content: json, source, scanMentions: true },
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Save failed" }));
          setError(err.error || "Save failed");
          setStatus("Save failed");
          return;
        }
        setError("");
        onSaved();
      } catch {
        setError("Save failed");
        setStatus("Save failed");
      }
    },
    [novelId, sceneId, onSaved, setStatus],
  );

  async function saveTitle(next: string) {
    const trimmed = next.trim() || "Scene";
    setSceneTitle(trimmed);
    try {
      const res = await fetch(`/api/novels/${novelId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "updateSceneTitle",
          payload: { sceneId, title: trimmed },
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Title save failed" }));
        setError(err.error || "Title save failed");
        return;
      }
      onSaved();
    } catch {
      setError("Title save failed");
    }
  }

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: hasApiKey
          ? "Write the scene… or type / for AI"
          : "Write the scene…",
      }),
    ],
    content: contentJson,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "manuscript min-h-[12rem]",
      },
      handleKeyDown: (_view, event) => {
        if (!hasApiKey) return false;
        if (event.key === "/" && !event.metaKey && !event.ctrlKey) {
          const { state } = _view;
          const $from = state.selection.$from;
          const textBefore = $from.parent.textBetween(0, $from.parentOffset, undefined, "\ufffc");
          if (textBefore === "" || textBefore.endsWith(" ") || textBefore.endsWith("\n")) {
            setSlashOpen(true);
            setError("");
          }
        }
        if (event.key === "Escape") {
          setSlashOpen(false);
          setActiveCommand(null);
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
    // Only reset on scene switch; restore() sets content directly after history restore.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneId, editor]);

  async function loadRevisions() {
    const res = await fetch(`/api/novels/${novelId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "listRevisions", payload: { sceneId } }),
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
        payload: { sceneId, revisionId },
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

  async function runCommand(opts?: { checkMode?: "plan" | "apply"; improvementPlan?: string }) {
    if (!activeCommand || !editor || !hasApiKey) return;
    setBusy(true);
    setStreaming("");
    setHunks(null);
    setError("");
    if (opts?.checkMode !== "apply") setFeedbackText("");
    setLastTrace(null);
    setTrace({ thinking: "", tools: [] });
    setTraceCollapsed(false);
    discardedRef.current = false;
    runIdRef.current = null;
    setRunId(null);
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
          checkMode: opts?.checkMode,
          improvementPlan: opts?.improvementPlan,
        }),
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: "Failed" }));
        throw new Error(err.error || "Generation failed");
      }
      const result = await consumeAgentStream(res, (state) => {
        runIdRef.current = state.runId;
        setRunId(state.runId);
        setStreaming(state.output);
        const nextTrace = { thinking: state.thinking, tools: state.tools };
        traceRef.current = nextTrace;
        setTrace(nextTrace);
        if (state.status) setStatus(state.status);
      });

      if (discardedRef.current) {
        discardedRef.current = false;
        setStatus("");
        return;
      }

      const full = result.output;
      setLastTrace(traceRef.current);
      setTraceCollapsed(true);

      const isExpand =
        activeCommand.slug === "expand" || activeCommand.slug.startsWith("expand-");
      const isRewrite =
        activeCommand.slug === "rewrite" || activeCommand.slug.startsWith("rewrite-");
      const isCheck = activeCommand.slug.startsWith("check-");
      const isLayer = activeCommand.slug === "layer";
      const applying = opts?.checkMode === "apply";
      const append = result.apply === "append" || (isExpand && result.apply !== "replace");
      if (append) {
        const next = `${originalPlain.trim()}\n\n${full.trim()}`.trim();
        const json = tipTapFromPlain(next);
        editor.commands.setContent(JSON.parse(json));
        await persist(json, isLayer ? "layer" : "expand");
        setActiveCommand(null);
        setInstruction("");
        setStreaming("");
        setLastTrace(null);
      } else if (isRewrite || applying || isLayer) {
        setHunks(buildRewriteHunks(originalPlain, full.trim()));
      } else {
        setFeedbackText(full.trim());
        if (isCheck) setLastPlan(full.trim());
      }
      setStatus("");
    } catch (e) {
      if (discardedRef.current) {
        discardedRef.current = false;
        setStatus("");
        return;
      }
      setError(e instanceof Error ? e.message : "Generation failed");
      setStatus("");
    } finally {
      setBusy(false);
      setStreaming("");
      runIdRef.current = null;
      setRunId(null);
    }
  }

  async function stopCommand() {
    const id = runIdRef.current;
    if (id) await stopAgentRun(id);
  }

  function discardCommand() {
    if (busy && runIdRef.current) {
      discardedRef.current = true;
      void stopAgentRun(runIdRef.current);
    }
    setActiveCommand(null);
    setStreaming("");
    setFeedbackText("");
    setLastPlan("");
    setError("");
    setTrace({ thinking: "", tools: [] });
    setLastTrace(null);
    setHunks(null);
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
    setLastTrace(null);
  }

  return (
    <section
      className={`scroll-mt-36 border-b border-border/70 py-8 ${
        isActive ? "-mx-2 rounded-lg bg-surface/20 px-2" : ""
      }`}
      data-scene-id={sceneId}
      data-chapter-id={chapterId}
      data-act-id={actId}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <input
          className="min-w-0 flex-1 bg-transparent font-serif text-xl text-muted outline-none ring-accent focus:text-text focus:ring-1"
          value={sceneTitle}
          aria-label="Scene title"
          onChange={(e) => setSceneTitle(e.target.value)}
          onBlur={(e) => void saveTitle(e.target.value)}
        />
        <div className="flex shrink-0 items-center gap-3">
          {hasApiKey ? (
            <button
              type="button"
              className="text-xs text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              onClick={() => {
                setSlashOpen(true);
                setError("");
              }}
            >
              / AI
            </button>
          ) : null}
          <button
            type="button"
            className="text-xs text-muted underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            onClick={() => void loadRevisions()}
          >
            History
          </button>
        </div>
      </div>

      <EditorContent editor={editor} />

      {error ? (
        <p className="mt-2 rounded-md border border-border bg-bg px-2 py-2 text-xs text-danger">
          {error}
        </p>
      ) : null}

      {slashOpen && !activeCommand ? (
        <div className="mt-3 rounded-md border border-border bg-surface p-2 panel-enter">
          {!hasApiKey ? (
            <p className="px-2 py-2 text-sm text-muted">
              Add an OpenRouter key in{" "}
              <Link href="/settings" className="text-accent hover:underline">
                Settings
              </Link>{" "}
              to use slash commands.
            </p>
          ) : (
            <>
              <p className="px-2 pb-1 text-xs uppercase tracking-wide text-muted">
                Commands
              </p>
              {commands.map((c) => (
                <button
                  key={c.slug}
                  type="button"
                  className="block w-full rounded px-2 py-2 text-left hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
                  onClick={() => {
                    setActiveCommand(c);
                    setLastPlan("");
                    setSlashOpen(false);
                  }}
                >
                  <span className="font-medium">/{c.slug}</span>
                  <span className="ml-2 text-sm text-muted">{c.description}</span>
                </button>
              ))}
            </>
          )}
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
          <p className="mt-1 text-xs text-muted">
            {activeCommand.description || "AI will use lore tools when helpful."}
          </p>
          {(activeCommand.slug === "density" ||
            activeCommand.slug.startsWith("scrub-") ||
            activeCommand.slug.startsWith("check-")) && (
            <p className="mt-1 text-xs text-muted">
              {activeCommand.slug.startsWith("check-")
                ? "Plan only on Run. Apply plan changes nothing except listed items, then you review hunks."
                : "Cleanup only — results stay in this panel. Density is a count, not an AI score."}
            </p>
          )}
          {activeCommand.slug === "expand" ||
          activeCommand.slug.startsWith("expand-") ? (
            <p className="mt-1 text-xs text-muted">
              Expand curates lore, sets scene sliders if needed, writes in layers, then runs
              plan-then-apply checks on the new prose. Status will step through each pass. Turn this
              off under Settings → Drafting pipeline for a single-shot draft.
            </p>
          ) : null}
          {activeCommand.slug === "layer" ? (
            <p className="mt-1 text-xs text-muted">
              Same pipeline as Expand. Existing scenes append the new prose; review if you used
              Layer with the pipeline off.
            </p>
          ) : null}
          <textarea
            className="mt-2 w-full rounded-md border border-border bg-bg px-2 py-2 text-sm outline-none ring-accent focus:ring-2"
            rows={3}
            placeholder={
              activeCommand.slug === "rewrite" ||
              activeCommand.slug.startsWith("rewrite-")
                ? 'Target length, e.g. "400 words" or "cut by about a third"'
                : 'Optional notes, e.g. "600 words" or "stay in Elena\'s POV"'
            }
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
          />
          <div className="mt-2">
            <AgentTracePanel
              thinking={trace.thinking}
              tools={trace.tools}
              collapsed={false}
              live={busy}
            />
          </div>
          {streaming ? (
            <div className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-md bg-bg p-2 text-sm">
              {streaming}
            </div>
          ) : null}
          {feedbackText && !busy ? (
            <div className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-md bg-bg p-2 text-sm">
              {feedbackText}
            </div>
          ) : null}
          <div className="mt-2 flex gap-2">
            {busy ? (
              <button
                type="button"
                disabled={!runId}
                className="rounded-md border border-danger px-3 py-1.5 text-sm text-danger disabled:opacity-50"
                onClick={() => void stopCommand()}
              >
                Stop
              </button>
            ) : (
              <button
                type="button"
                className="rounded-md bg-accent px-3 py-1.5 text-sm text-bg disabled:opacity-50"
                onClick={() => void runCommand()}
              >
                Run
              </button>
            )}
            {activeCommand.slug.startsWith("check-") && lastPlan && !busy ? (
              <button
                type="button"
                className="rounded-md border border-border px-3 py-1.5 text-sm"
                onClick={() =>
                  void runCommand({ checkMode: "apply", improvementPlan: lastPlan })
                }
              >
                Apply plan only
              </button>
            ) : null}
            <button
              type="button"
              className="rounded-md border border-border px-3 py-1.5 text-sm"
              onClick={discardCommand}
            >
              Discard
            </button>
          </div>
        </div>
      ) : null}

      {hunks ? (
        <div className="mt-4 rounded-md border border-border bg-surface p-3 panel-enter">
          {lastTrace ? (
            <div className="mb-3">
              <AgentTracePanel
                thinking={lastTrace.thinking}
                tools={lastTrace.tools}
                collapsed={traceCollapsed}
                onToggle={() => setTraceCollapsed((c) => !c)}
              />
            </div>
          ) : null}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium">Review rewrite</p>
            <button
              type="button"
              className="rounded-md bg-accent px-2 py-1 text-xs text-bg"
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
              className="rounded-md border border-border px-2 py-1 text-xs"
              onClick={() => {
                setHunks(null);
                setStreaming("");
                setLastTrace(null);
                if (editor) {
                  editor.commands.setContent(JSON.parse(tipTapFromPlain(preRewrite)));
                }
              }}
            >
              Reject all
            </button>
            <button
              type="button"
              className="rounded-md border border-border px-2 py-1 text-xs"
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
                      setHunks(
                        (prev) =>
                          prev?.map((x) =>
                            x.id === h.id ? { ...x, accepted: "new" } : x,
                          ) ?? null,
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
          <p className="mt-1 text-xs text-muted">
            Undecided hunks keep the original text.
          </p>
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
            {revisions.length === 0 ? (
              <li className="text-muted">No revisions yet.</li>
            ) : null}
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
