"use client";

import { useEffect, useRef, useState } from "react";
import { AgentTracePanel } from "@/components/agent-trace-panel";
import {
  consumeAgentStream,
  stopAgentRun,
  type ToolTraceEntry,
} from "@/lib/agent-stream-client";
import { commandKind } from "@/lib/command-kind";
import { useEditorStore } from "@/store/editor";
import { useWorkspaceStore } from "@/store/workspace";
import type { DraftResult } from "@/components/chapter-editor";

type Command = { slug: string; label: string; description: string | null };
type ChatMessage = {
  id: string;
  role: string;
  content: string;
  metaJson?: string | null;
};

const PINNED_ACTIONS = ["expand", "rewrite", "layer"];

export function ChapterChat({
  novelId,
  chapterId,
  proseId,
  commands,
  model,
  onModelChange,
  hasApiKey,
  onChange,
  onDraft,
  onCollapse,
  className,
}: {
  novelId: string;
  chapterId: string | null;
  proseId: string | null;
  commands: Command[];
  model: string;
  onModelChange: (model: string) => void;
  hasApiKey: boolean;
  onChange: () => void;
  onDraft: (draft: DraftResult) => void;
  onCollapse?: () => void;
  className?: string;
}) {
  const setStatus = useEditorStore((s) => s.setStatus);
  const selection = useWorkspaceStore((s) => s.selection);
  const actionSlug = useWorkspaceStore((s) => s.actionSlug);
  const setActionSlug = useWorkspaceStore((s) => s.setActionSlug);
  const editAction = useWorkspaceStore((s) => s.editAction);
  const clearSelection = useWorkspaceStore((s) => s.clearSelection);
  const clearAction = useWorkspaceStore((s) => s.clearAction);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [streaming, setStreaming] = useState("");
  const [error, setError] = useState("");
  const [trace, setTrace] = useState<{ thinking: string; tools: ToolTraceEntry[] }>({
    thinking: "",
    tools: [],
  });
  const runIdRef = useRef<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const action = commands.find((c) => c.slug === actionSlug) ?? null;
  const actionChoices = [...commands].sort((a, b) => {
    const ai = PINNED_ACTIONS.indexOf(a.slug);
    const bi = PINNED_ACTIONS.indexOf(b.slug);
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  async function load() {
    if (!chapterId) return;
    const res = await fetch(
      `/api/ai/chapter-chat?novelId=${encodeURIComponent(novelId)}&chapterId=${encodeURIComponent(chapterId)}`,
    );
    if (!res.ok) return;
    setMessages(await res.json());
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterId, novelId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages, streaming]);

  async function submit() {
    if (!chapterId || !hasApiKey) return;
    const note = draft.trim();
    if (!note && !selection && !action) return;
    setBusy(true);
    setError("");
    setStreaming("");
    setTrace({ thinking: "", tools: [] });
    setStatus("Chapter chat…");

    const kind = action ? commandKind(action.slug) : "feedback";
    const isDraft = kind === "expand" || kind === "rewrite" || kind === "layer";

    try {
      if (isDraft && proseId) {
        await fetch("/api/ai/chapter-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            novelId,
            chapterId,
            message: note || `Run ${action?.label}`,
            selection,
            actionSlug: action?.slug,
            persistOnly: true,
          }),
        });
        const res = await fetch("/api/ai/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            commandSlug: action!.slug,
            novelId,
            sceneId: proseId,
            chapterId,
            instruction: note,
            selection,
            model,
          }),
        });
        if (!res.ok || !res.body) {
          const err = await res.json().catch(() => ({ error: "Failed" }));
          throw new Error(err.error || "Generation failed");
        }
        const result = await consumeAgentStream(res, (state) => {
          runIdRef.current = state.runId;
          setStreaming(state.output);
          setTrace({ thinking: state.thinking, tools: state.tools });
          if (state.status) setStatus(state.status);
        });
        const append = result.apply === "append" || kind === "expand";
        onDraft({
          text: result.output,
          apply: append ? "append" : "replace",
          source: kind,
        });
        await fetch("/api/ai/chapter-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            novelId,
            chapterId,
            message: "Draft is ready in the manuscript. Review hunks if this was a rewrite.",
            persistOnly: true,
            role: "assistant",
          }),
        });
      } else if (kind === "check" || kind === "feedback") {
        const res = await fetch("/api/ai/chapter-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            novelId,
            chapterId,
            message: note || (action ? `Run ${action.label}` : "Help with this chapter."),
            selection,
            actionSlug: action?.slug,
            model,
          }),
        });
        if (!res.ok || !res.body) {
          const err = await res.json().catch(() => ({ error: "Failed" }));
          throw new Error(err.error || "Chat failed");
        }
        const result = await consumeAgentStream(res, (state) => {
          runIdRef.current = state.runId;
          setStreaming(state.output);
          setTrace({ thinking: state.thinking, tools: state.tools });
          if (state.status) setStatus(state.status);
        });
        if (result.draft?.text) {
          onDraft({
            text: result.draft.text,
            apply: result.draft.apply,
            source: "rewrite",
          });
        }
      }
      setDraft("");
      clearSelection();
      clearAction();
      await load();
      onChange();
      setStatus("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      setStatus("");
    } finally {
      setBusy(false);
      setStreaming("");
      runIdRef.current = null;
    }
  }

  if (!chapterId) {
    return (
      <aside
        className={`flex h-full w-[320px] shrink-0 flex-col border-l border-border bg-surface/70 p-3 ${className ?? ""}`}
      >
        <h2 className="font-serif text-lg">Chat</h2>
        <p className="mt-3 text-sm text-muted">Open a chapter to chat about it.</p>
      </aside>
    );
  }

  return (
    <aside
      className={`flex h-full min-h-0 w-[320px] shrink-0 flex-col border-l border-border bg-surface/70 ${className ?? ""}`}
    >
      <div className="border-b border-border px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-serif text-lg">Chat</h2>
          {onCollapse ? (
            <button type="button" className="text-xs text-muted hover:underline" onClick={onCollapse}>
              Hide
            </button>
          ) : null}
        </div>
        <p className="mt-1 text-xs text-muted">Ask, expand, or rewrite this chapter.</p>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-auto p-3 text-sm">
        {messages.length === 0 ? (
          <p className="text-muted">
            {hasApiKey
              ? "Ask about this chapter, or attach Expand to continue the draft."
              : "Add an OpenRouter key in Settings to use chat and Actions."}
          </p>
        ) : null}
        {messages.map((m) => (
          <div key={m.id} className={m.role === "user" ? "text-text" : "text-muted"}>
            <p className="text-xs uppercase tracking-wide text-muted">
              {m.role === "user" ? "You" : "Assistant"}
            </p>
            <p className="mt-1 whitespace-pre-wrap">{m.content}</p>
          </div>
        ))}
        {streaming ? <p className="whitespace-pre-wrap text-text">{streaming}</p> : null}
        <div ref={bottomRef} />
      </div>
      {busy && (trace.thinking || trace.tools.length > 0) ? (
        <div className="border-t border-border px-3 py-2">
          <AgentTracePanel thinking={trace.thinking} tools={trace.tools} collapsed={false} live />
        </div>
      ) : null}
      {error ? <p className="px-3 text-xs text-danger">{error}</p> : null}
      <div className="border-t border-border p-3">
        <div className="mb-2 flex flex-wrap items-center gap-1">
          <label className="sr-only" htmlFor="chapter-action">
            Action
          </label>
          <select
            id="chapter-action"
            className="max-w-full rounded-md border border-border bg-bg px-1.5 py-1 text-xs text-muted"
            value={actionSlug ?? ""}
            disabled={!hasApiKey || busy}
            onChange={(e) => setActionSlug(e.target.value || null)}
          >
            <option value="">No action</option>
            {actionChoices.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.label}
              </option>
            ))}
          </select>
          {selection ? (
            <button
              type="button"
              className="rounded-md border border-border bg-bg px-1.5 py-0.5 text-xs"
              title={selection}
              onClick={clearSelection}
            >
              Selection {Math.min(selection.length, 999)}c ×
            </button>
          ) : null}
          {action ? (
            <button
              type="button"
              className="rounded-md border border-accent bg-accent-soft px-1.5 py-0.5 text-xs text-accent"
              onClick={() => editAction(action.slug)}
            >
              Edit {action.label}
            </button>
          ) : null}
        </div>
        <textarea
          className="w-full rounded-md border border-border bg-bg px-2 py-2 text-sm"
          rows={3}
          placeholder={hasApiKey ? "Ask or add a note…" : "Add an OpenRouter key in Settings to chat."}
          value={draft}
          disabled={!hasApiKey || busy}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void submit();
            }
          }}
        />
        <div className="mt-2 flex items-center gap-2">
          {busy ? (
            <button
              type="button"
              className="rounded-md border border-danger px-2 py-1 text-xs text-danger"
              onClick={() => {
                if (runIdRef.current) void stopAgentRun(runIdRef.current);
              }}
            >
              Stop
            </button>
          ) : (
            <button
              type="button"
              className="rounded-md bg-accent px-2 py-1 text-xs text-bg disabled:opacity-50"
              disabled={!hasApiKey || (!draft.trim() && !selection && !action)}
              onClick={() => void submit()}
            >
              Send
            </button>
          )}
          <label className="min-w-0 flex-1">
            <span className="sr-only">Model</span>
            <input
              className="w-full rounded border border-border bg-bg px-1.5 py-1 font-mono text-xs text-muted disabled:opacity-50"
              value={model}
              disabled={!hasApiKey}
              onChange={(e) => onModelChange(e.target.value)}
              spellCheck={false}
              aria-label="Model"
            />
          </label>
        </div>
      </div>
    </aside>
  );
}
