"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { AgentTracePanel } from "@/components/agent-trace-panel";
import {
  consumeAgentStream,
  stopAgentRun,
  type ToolTraceEntry,
} from "@/lib/agent-stream-client";
import {
  QUESTION_BANK,
  questionsForLayer,
  type Question,
  type QuestionLayer,
} from "@/lib/question-bank";

type Beat = { id: string; content: string };
type Chapter = {
  id: string;
  title: string;
  goal: string | null;
  summary: string | null;
  beats: Beat[];
  scenes: Array<{ id: string }>;
};
type Act = {
  id: string;
  title: string;
  brief: string | null;
  introduces: string | null;
  accomplishes: string | null;
  losses: string | null;
  stateStart: string | null;
  stateEnd: string | null;
  chapters: Chapter[];
};
type Tree = {
  novel: {
    id: string;
    title: string;
    premise: string | null;
    genre: string | null;
    tone: string | null;
    themes: string | null;
    stakes: string | null;
    protagonistFocus: string | null;
    endingIntention: string | null;
    styleGuideJson: string | null;
    styleSamplesJson: string | null;
  };
  acts: Act[];
  overviewMessages: Array<{ id: string; role: string; content: string }>;
  overviewAnswers: Array<{ questionId: string; answer: string }>;
  comps: Array<{
    id: string;
    title: string;
    author: string | null;
    notes: string | null;
    chapterBreakdownJson: string | null;
  }>;
};

const LAYER_LABELS: Record<QuestionLayer, string> = {
  novel: "Novel",
  act: "Act",
  chapter: "Chapter",
  beat: "Beat",
  review: "Review",
};

const LAYERS: QuestionLayer[] = ["novel", "act", "chapter", "beat", "review"];

export default function OverviewPage() {
  const params = useParams<{ id: string }>();
  const novelId = params.id;
  const [data, setData] = useState<Tree | null>(null);
  const [mode, setMode] = useState<"fill" | "review">("fill");
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState("");
  const [error, setError] = useState("");
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
  const runIdRef = useRef<string | null>(null);
  const traceRef = useRef<{ thinking: string; tools: ToolTraceEntry[] }>({
    thinking: "",
    tools: [],
  });
  const [hasApiKey, setHasApiKey] = useState(true);
  const [expandedActs, setExpandedActs] = useState<Set<string>>(new Set());
  const [confirmDeleteAct, setConfirmDeleteAct] = useState<string | null>(null);
  const [mobilePane, setMobilePane] = useState<"outline" | "assistant">("outline");

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/novels/${novelId}`);
    if (!res.ok) {
      setData(null);
      setError("Could not load this novel.");
      return;
    }
    const tree = (await res.json()) as Tree;
    setData(tree);
    setError("");
    setExpandedActs((prev) => {
      if (prev.size > 0) return prev;
      const first = tree.acts[0]?.id;
      return first ? new Set([first]) : new Set();
    });
  }, [novelId]);

  useEffect(() => {
    void refresh();
    void fetch("/api/settings")
      .then((r) => r.json())
      .then((s) => {
        setHasApiKey(Boolean(s.settings?.openrouterApiKey));
      })
      .catch(() => setHasApiKey(false));
  }, [refresh]);

  const answered = useMemo(
    () => new Set(data?.overviewAnswers.map((a) => a.questionId) ?? []),
    [data],
  );

  async function patch(action: string, payload: Record<string, unknown>) {
    const res = await fetch(`/api/novels/${novelId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, payload }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Save failed" }));
      setError(err.error || "Save failed");
      await refresh();
      return;
    }
    setError("");
    await refresh();
  }

  async function sendChat(message: string) {
    if (!message.trim() || !hasApiKey) return;
    setBusy(true);
    setStreaming("");
    setError("");
    setLastTrace(null);
    setTrace({ thinking: "", tools: [] });
    setTraceCollapsed(false);
    runIdRef.current = null;
    setRunId(null);
    try {
      const res = await fetch("/api/ai/overview-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ novelId, message, mode }),
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: "Failed" }));
        throw new Error(err.error || "Chat failed");
      }
      const result = await consumeAgentStream(res, (state) => {
        runIdRef.current = state.runId;
        setRunId(state.runId);
        setStreaming(state.output);
        const nextTrace = { thinking: state.thinking, tools: state.tools };
        traceRef.current = nextTrace;
        setTrace(nextTrace);
      });
      setInput("");
      setLastTrace(traceRef.current);
      setTraceCollapsed(true);
      if (result.output) {
        setStreaming("");
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
      setStreaming("");
      runIdRef.current = null;
      setRunId(null);
    }
  }

  async function stopChat() {
    const id = runIdRef.current;
    if (id) await stopAgentRun(id);
  }

  function askQuestion(q: Question) {
    setMobilePane("assistant");
    void sendChat(`Let's work on ${q.id}: ${q.prompt}`);
    if (q.layer === "novel") {
      document.getElementById("overview-novel")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function toggleAct(actId: string) {
    setExpandedActs((prev) => {
      const next = new Set(prev);
      if (next.has(actId)) next.delete(actId);
      else next.add(actId);
      return next;
    });
  }

  if (!data) {
    return (
      <div className="min-h-full">
        <AppHeader />
        <p className="p-8 text-muted">{error || "Loading overview…"}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader novelId={novelId} novelTitle={data.novel.title} mode="overview" />

      <div className="flex border-b border-border lg:hidden">
        <button
          type="button"
          className={`flex-1 px-3 py-2 text-sm ${
            mobilePane === "outline" ? "bg-accent-soft text-accent" : "text-muted"
          }`}
          onClick={() => setMobilePane("outline")}
        >
          Outline
        </button>
        <button
          type="button"
          className={`flex-1 px-3 py-2 text-sm ${
            mobilePane === "assistant" ? "bg-accent-soft text-accent" : "text-muted"
          }`}
          onClick={() => setMobilePane("assistant")}
        >
          Assistant
        </button>
      </div>

      <div className="mx-auto grid min-h-0 w-full max-w-[1600px] flex-1 grid-cols-1 gap-0 lg:grid-cols-[1fr_380px]">
        <section
          className={`overflow-y-auto border-r border-border p-6 ${
            mobilePane === "outline" ? "block" : "hidden lg:block"
          }`}
        >
          <div id="overview-novel" className="mb-8 scroll-mt-20">
            <input
              className="w-full bg-transparent font-display text-4xl tracking-tight outline-none"
              value={data.novel.title}
              aria-label="Novel title"
              onChange={(e) =>
                setData((d) => (d ? { ...d, novel: { ...d.novel, title: e.target.value } } : d))
              }
              onBlur={(e) => void patch("updateNovel", { title: e.target.value })}
            />
            <textarea
              className="mt-3 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
              rows={3}
              placeholder="Premise — the story in a few sentences"
              value={data.novel.premise ?? ""}
              onChange={(e) =>
                setData((d) =>
                  d ? { ...d, novel: { ...d.novel, premise: e.target.value } } : d,
                )
              }
              onBlur={(e) => void patch("updateNovel", { premise: e.target.value })}
            />
          </div>

          <OverviewCraftPanels
            novelId={novelId}
            data={data}
            hasApiKey={hasApiKey}
            busy={busy}
            onPatch={patch}
            onVariants={() =>
              void sendChat(
                "Ignore fill/review for a moment. I want outline arrangement OPTIONS only — do not apply them. Propose 2–3 distinct spines (personal-story-first, problem-first, chronological or better fits) from the existing acts/chapters/beats.",
              )
            }
            onRefresh={() => void refresh()}
          />

          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">Structure</p>
            <button
              type="button"
              className="rounded-md bg-accent px-3 py-1.5 text-sm text-bg"
              onClick={() =>
                void patch("upsertAct", {
                  title: `Act ${data.acts.length + 1}`,
                  brief: "",
                })
              }
            >
              Add act
            </button>
          </div>

          {data.acts.length === 0 ? (
            <div className="rounded-lg border border-border bg-surface/50 p-6 panel-enter">
              <p className="font-serif text-xl">Start the outline</p>
              <p className="mt-2 max-w-md text-sm text-muted">
                Add an act to sketch the arc, then fill chapters and beats. The assistant can walk
                the question bank with you — or edit everything by hand.
              </p>
              <button
                type="button"
                className="mt-4 rounded-md bg-accent px-3 py-1.5 text-sm text-bg"
                onClick={() =>
                  void patch("upsertAct", {
                    title: "Act 1",
                    brief: "",
                  })
                }
              >
                Add first act
              </button>
            </div>
          ) : null}

          {data.acts.map((act) => {
            const open = expandedActs.has(act.id);
            return (
              <ActCard
                key={act.id}
                act={act}
                open={open}
                novelId={novelId}
                confirmDelete={confirmDeleteAct === act.id}
                onToggle={() => toggleAct(act.id)}
                onConfirmDelete={() => setConfirmDeleteAct(act.id)}
                onCancelDelete={() => setConfirmDeleteAct(null)}
                onDelete={async () => {
                  await patch("deleteAct", { actId: act.id });
                  setConfirmDeleteAct(null);
                }}
                onHelp={() => {
                  setMobilePane("assistant");
                  void sendChat(`Help me fill this act: ${act.title} (id ${act.id}).`);
                }}
                onPatch={patch}
                setData={setData}
                onRefresh={() => void refresh()}
              />
            );
          })}
        </section>

        <aside
          className={`flex max-h-[calc(100vh-3.5rem)] flex-col overflow-hidden bg-surface/60 ${
            mobilePane === "assistant" ? "flex" : "hidden lg:flex"
          }`}
        >
          <div className="border-b border-border p-3">
            <div className="flex items-center gap-1 rounded-md border border-border bg-surface p-0.5">
              <button
                type="button"
                className={`rounded px-3 py-1 text-sm transition ${
                  mode === "fill" ? "bg-accent-soft text-accent" : "text-muted hover:text-text"
                }`}
                onClick={() => setMode("fill")}
              >
                Fill
              </button>
              <button
                type="button"
                className={`rounded px-3 py-1 text-sm transition ${
                  mode === "review" ? "bg-accent-soft text-accent" : "text-muted hover:text-text"
                }`}
                onClick={() => setMode("review")}
              >
                Review
              </button>
              <button
                type="button"
                className="ml-auto px-2 text-xs text-muted hover:text-text hover:underline disabled:opacity-50"
                disabled={!hasApiKey || busy}
                onClick={() => void sendChat("Review the whole outline for coherence.")}
              >
                Review whole outline
              </button>
            </div>

            <p className="mt-3 text-xs text-muted">
              Checklist {answered.size}/{QUESTION_BANK.length}
            </p>
            <div className="mt-2 max-h-40 space-y-3 overflow-auto">
              {LAYERS.map((layer) => {
                const qs = questionsForLayer(layer);
                if (qs.length === 0) return null;
                return (
                  <div key={layer}>
                    <p className="mb-1 text-[10px] uppercase tracking-[0.2em] text-muted">
                      {LAYER_LABELS[layer]}
                    </p>
                    <ul className="space-y-0.5">
                      {qs.map((q) => {
                        const done = answered.has(q.id);
                        return (
                          <li key={q.id}>
                            <button
                              type="button"
                              disabled={!hasApiKey || busy}
                              title={q.whyItMatters}
                              className={`block w-full truncate rounded px-2 py-1.5 text-left text-xs disabled:opacity-50 ${
                                done
                                  ? "text-accent"
                                  : "text-muted hover:bg-bg hover:text-text"
                              }`}
                              onClick={() => askQuestion(q)}
                            >
                              <span className="mr-1.5">{done ? "✓" : "○"}</span>
                              {q.prompt}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex-1 space-y-3 overflow-auto p-3 text-sm">
            {data.overviewMessages.length === 0 && !streaming && !busy ? (
              <p className="text-sm text-muted">
                Ask the overview helper to fill gaps or audit coherence. Click a checklist item to
                start.
              </p>
            ) : null}
            {(() => {
              const lastAssistantId = [...data.overviewMessages]
                .reverse()
                .find((msg) => msg.role === "assistant")?.id;
              return data.overviewMessages.map((m) => {
                const showTrace =
                  m.role === "assistant" && m.id === lastAssistantId && lastTrace && !busy;
                return (
                  <div
                    key={m.id}
                    className={`rounded-md p-2 panel-enter ${
                      m.role === "user" ? "bg-accent-soft" : "border border-border bg-bg"
                    }`}
                  >
                    <p className="mb-1 text-[10px] uppercase tracking-wide text-muted">
                      {m.role === "user" ? "You" : "Assistant"}
                    </p>
                    {showTrace && lastTrace ? (
                      <div className="mb-2">
                        <AgentTracePanel
                          thinking={lastTrace.thinking}
                          tools={lastTrace.tools}
                          collapsed={traceCollapsed}
                          onToggle={() => setTraceCollapsed((c) => !c)}
                        />
                      </div>
                    ) : null}
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  </div>
                );
              });
            })()}
            {busy ? (
              <div className="rounded-md border border-border bg-bg p-2 panel-enter">
                <p className="mb-1 text-[10px] uppercase tracking-wide text-muted">Assistant</p>
                <AgentTracePanel
                  thinking={trace.thinking}
                  tools={trace.tools}
                  collapsed={false}
                  live
                />
                {streaming ? (
                  <p className="mt-2 whitespace-pre-wrap">{streaming}</p>
                ) : null}
              </div>
            ) : null}
            {error ? (
              <p className="rounded-md border border-border bg-bg px-2 py-2 text-xs text-danger">
                {error}
              </p>
            ) : null}
          </div>

          <div className="border-t border-border p-3">
            {!hasApiKey ? (
              <p className="mb-2 text-xs text-muted">
                Add an OpenRouter API key in{" "}
                <Link href="/settings" className="text-accent hover:underline">
                  Settings
                </Link>{" "}
                to use the assistant.
              </p>
            ) : null}
            <textarea
              className="w-full rounded-md border border-border bg-bg px-2 py-2 text-sm outline-none ring-accent focus:ring-2 disabled:opacity-50"
              rows={3}
              placeholder="Ask the overview helper…"
              value={input}
              disabled={!hasApiKey || busy}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void sendChat(input);
                }
              }}
            />
            {busy ? (
              <button
                type="button"
                disabled={!runId}
                className="mt-2 w-full rounded-md border border-danger py-2 text-sm text-danger disabled:opacity-50"
                onClick={() => void stopChat()}
              >
                Stop
              </button>
            ) : (
              <button
                type="button"
                disabled={!hasApiKey || !input.trim()}
                className="mt-2 w-full rounded-md bg-accent py-2 text-sm text-bg disabled:opacity-50"
                onClick={() => void sendChat(input)}
              >
                Send
              </button>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function ActCard({
  act,
  open,
  novelId,
  confirmDelete,
  onToggle,
  onConfirmDelete,
  onCancelDelete,
  onDelete,
  onHelp,
  onPatch,
  setData,
  onRefresh,
}: {
  act: Act;
  open: boolean;
  novelId: string;
  confirmDelete: boolean;
  onToggle: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  onDelete: () => void;
  onHelp: () => void;
  onPatch: (action: string, payload: Record<string, unknown>) => Promise<void>;
  setData: Dispatch<SetStateAction<Tree | null>>;
  onRefresh: () => void;
}) {
  const metaFields = [
    ["introduces", "Introduces"],
    ["accomplishes", "Accomplishes"],
    ["losses", "Losses"],
    ["stateStart", "State start"],
    ["stateEnd", "State end"],
  ] as const;

  return (
    <article
      id={`act-${act.id}`}
      className="mb-6 scroll-mt-20 rounded-lg border border-border bg-surface/50 panel-enter"
    >
      <div className="flex items-start gap-2 p-4">
        <button
          type="button"
          className="mt-1 shrink-0 rounded px-1.5 py-0.5 text-xs text-muted hover:bg-bg hover:text-text"
          aria-expanded={open}
          onClick={onToggle}
        >
          {open ? "▾" : "▸"}
        </button>
        <div className="min-w-0 flex-1">
          <input
            className="w-full bg-transparent font-serif text-2xl outline-none"
            value={act.title}
            aria-label="Act title"
            onChange={(e) =>
              setData((d) =>
                d
                  ? {
                      ...d,
                      acts: d.acts.map((a) =>
                        a.id === act.id ? { ...a, title: e.target.value } : a,
                      ),
                    }
                  : d,
              )
            }
            onBlur={(e) => void onPatch("upsertAct", { id: act.id, title: e.target.value })}
          />
          <textarea
            className="mt-2 w-full rounded-md border border-border bg-bg px-2 py-2 text-sm"
            rows={2}
            placeholder="Act brief: what changes from start to end…"
            value={act.brief ?? ""}
            onChange={(e) =>
              setData((d) =>
                d
                  ? {
                      ...d,
                      acts: d.acts.map((a) =>
                        a.id === act.id ? { ...a, brief: e.target.value } : a,
                      ),
                    }
                  : d,
              )
            }
            onBlur={(e) =>
              void onPatch("upsertAct", {
                id: act.id,
                title: act.title,
                brief: e.target.value,
              })
            }
          />
          {!open && act.brief ? (
            <p className="mt-1 line-clamp-1 text-xs text-muted">{act.brief}</p>
          ) : null}
          <p className="mt-2 text-xs text-muted">
            {act.chapters.length} chapter{act.chapters.length === 1 ? "" : "s"}
            {!open ? " · expand for arc fields & beats" : ""}
          </p>
        </div>
      </div>

      {open ? (
        <div className="border-t border-border px-4 pb-4 pt-3">
          <div className="grid gap-2 sm:grid-cols-2">
            {metaFields.map(([key, label]) => (
              <label key={key} className="text-xs text-muted">
                {label}
                <input
                  className="mt-1 w-full rounded-md border border-border bg-bg px-2 py-1 text-sm text-text"
                  value={(act[key] as string) ?? ""}
                  onBlur={(e) =>
                    void onPatch("upsertAct", {
                      id: act.id,
                      title: act.title,
                      [key]: e.target.value,
                    })
                  }
                  onChange={(e) =>
                    setData((d) =>
                      d
                        ? {
                            ...d,
                            acts: d.acts.map((a) =>
                              a.id === act.id ? { ...a, [key]: e.target.value } : a,
                            ),
                          }
                        : d,
                    )
                  }
                />
              </label>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              className="text-xs text-accent hover:underline"
              onClick={() =>
                void onPatch("upsertChapter", {
                  actId: act.id,
                  title: `Chapter ${act.chapters.length + 1}`,
                })
              }
            >
              + Chapter
            </button>
            <button type="button" className="text-xs text-muted hover:underline" onClick={onHelp}>
              Help fill this act
            </button>
            {confirmDelete ? (
              <span className="flex items-center gap-2 text-xs">
                <span className="text-danger">Delete this act?</span>
                <button type="button" className="text-danger hover:underline" onClick={onDelete}>
                  Confirm
                </button>
                <button type="button" className="text-muted hover:underline" onClick={onCancelDelete}>
                  Cancel
                </button>
              </span>
            ) : (
              <button
                type="button"
                className="text-xs text-danger hover:underline"
                onClick={onConfirmDelete}
              >
                Delete act
              </button>
            )}
          </div>

          <ul className="mt-4 space-y-3">
            {act.chapters.map((ch) => (
              <ChapterBlock
                key={ch.id}
                chapter={ch}
                actId={act.id}
                novelId={novelId}
                onPatch={onPatch}
                setData={setData}
                onRefresh={onRefresh}
              />
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  );
}

function ChapterBlock({
  chapter,
  actId,
  novelId,
  onPatch,
  setData,
  onRefresh,
}: {
  chapter: Chapter;
  actId: string;
  novelId: string;
  onPatch: (action: string, payload: Record<string, unknown>) => Promise<void>;
  setData: Dispatch<SetStateAction<Tree | null>>;
  onRefresh: () => void;
}) {
  const [beats, setBeats] = useState(chapter.beats);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    setBeats(chapter.beats);
  }, [chapter.beats]);

  async function saveBeat(id: string | undefined, content: string) {
    await onPatch("upsertBeat", { id, chapterId: chapter.id, content });
  }

  async function removeBeat(beatId: string) {
    await onPatch("deleteBeat", { beatId });
  }

  async function moveBeat(index: number, dir: -1 | 1) {
    const next = [...beats];
    const j = index + dir;
    if (j < 0 || j >= next.length) return;
    [next[index], next[j]] = [next[j], next[index]];
    setBeats(next);
    await fetch(`/api/novels/${novelId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "reorderBeats",
        payload: { chapterId: chapter.id, orderedIds: next.map((b) => b.id) },
      }),
    });
    onRefresh();
  }

  return (
    <li className="rounded-md border border-border bg-bg p-3">
      <input
        className="w-full bg-transparent font-medium outline-none"
        value={chapter.title}
        aria-label="Chapter title"
        onBlur={(e) =>
          void onPatch("upsertChapter", {
            id: chapter.id,
            actId,
            title: e.target.value,
            goal: chapter.goal,
          })
        }
        onChange={(e) =>
          setData((d) =>
            d
              ? {
                  ...d,
                  acts: d.acts.map((a) =>
                    a.id === actId
                      ? {
                          ...a,
                          chapters: a.chapters.map((c) =>
                            c.id === chapter.id ? { ...c, title: e.target.value } : c,
                          ),
                        }
                      : a,
                  ),
                }
              : d,
          )
        }
      />
      <textarea
        className="mt-2 w-full rounded-md border border-border bg-surface px-2 py-1 text-sm"
        rows={2}
        placeholder="Chapter goal (milestone toward the act)"
        value={chapter.goal ?? ""}
        onBlur={(e) =>
          void onPatch("upsertChapter", {
            id: chapter.id,
            actId,
            title: chapter.title,
            goal: e.target.value,
          })
        }
        onChange={(e) =>
          setData((d) =>
            d
              ? {
                  ...d,
                  acts: d.acts.map((a) =>
                    a.id === actId
                      ? {
                          ...a,
                          chapters: a.chapters.map((c) =>
                            c.id === chapter.id ? { ...c, goal: e.target.value } : c,
                          ),
                        }
                      : a,
                  ),
                }
              : d,
          )
        }
      />
      <textarea
        className="mt-2 w-full rounded-md border border-border bg-surface px-2 py-1 text-sm"
        rows={3}
        placeholder="Chapter summary — what happens, who changes, promises to the reader"
        value={chapter.summary ?? ""}
        onBlur={(e) =>
          void onPatch("upsertChapter", {
            id: chapter.id,
            actId,
            title: chapter.title,
            goal: chapter.goal,
            summary: e.target.value,
          })
        }
        onChange={(e) =>
          setData((d) =>
            d
              ? {
                  ...d,
                  acts: d.acts.map((a) =>
                    a.id === actId
                      ? {
                          ...a,
                          chapters: a.chapters.map((c) =>
                            c.id === chapter.id ? { ...c, summary: e.target.value } : c,
                          ),
                        }
                      : a,
                  ),
                }
              : d,
          )
        }
      />
      <p className="mt-2 text-xs text-muted">
        Beats: {beats.length} · Scenes: {chapter.scenes.length} (siblings under chapter)
      </p>

      <ul className="mt-2 space-y-2">
        {beats.map((b, i) => (
          <li key={b.id} className="rounded border border-border bg-surface/80 p-2">
            <textarea
              className="w-full resize-y bg-transparent text-sm outline-none"
              rows={2}
              value={b.content}
              aria-label={`Beat ${i + 1}`}
              onChange={(e) =>
                setBeats((prev) =>
                  prev.map((x) => (x.id === b.id ? { ...x, content: e.target.value } : x)),
                )
              }
              onBlur={(e) => void saveBeat(b.id, e.target.value)}
            />
            <div className="mt-1 flex gap-2 text-xs text-muted">
              <button type="button" onClick={() => void moveBeat(i, -1)}>
                Up
              </button>
              <button type="button" onClick={() => void moveBeat(i, 1)}>
                Down
              </button>
              <button
                type="button"
                className="text-danger"
                onClick={() => void removeBeat(b.id)}
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-2">
        <textarea
          className="w-full rounded-md border border-border bg-surface px-2 py-1 text-sm"
          rows={2}
          placeholder="New beat…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button
          type="button"
          className="mt-2 rounded-md bg-accent px-2 py-1 text-xs text-bg disabled:opacity-50"
          disabled={!draft.trim()}
          onClick={async () => {
            await saveBeat(undefined, draft.trim());
            setDraft("");
          }}
        >
          Add beat
        </button>
      </div>
    </li>
  );
}

function OverviewCraftPanels({
  novelId,
  data,
  hasApiKey,
  busy,
  onPatch,
  onVariants,
  onRefresh,
}: {
  novelId: string;
  data: Tree;
  hasApiKey: boolean;
  busy: boolean;
  onPatch: (action: string, payload: Record<string, unknown>) => Promise<void>;
  onVariants: () => void;
  onRefresh: () => void;
}) {
  const [samples, setSamples] = useState("");
  const [guideDraft, setGuideDraft] = useState(data.novel.styleGuideJson ?? "");
  const [styleBusy, setStyleBusy] = useState(false);
  const [variants, setVariants] = useState("");
  const [varBusy, setVarBusy] = useState(false);
  const [compTitle, setCompTitle] = useState("");
  const [compAuthor, setCompAuthor] = useState("");
  const [compNotes, setCompNotes] = useState("");
  const [compBusy, setCompBusy] = useState(false);

  async function analyzeStyle() {
    setStyleBusy(true);
    try {
      const excerpts = samples
        .split("\n\n")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((excerpt) => ({ excerpt }));
      const res = await fetch("/api/ai/analyze-style", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ novelId, samples: excerpts }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      setGuideDraft(JSON.stringify(json.proposed, null, 2));
    } catch {
      /* keep draft */
    } finally {
      setStyleBusy(false);
    }
  }

  async function generateVariants() {
    setVarBusy(true);
    setVariants("");
    try {
      const res = await fetch("/api/ai/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: "overview_outline_variants",
          novelId,
          persist: false,
        }),
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: "Failed" }));
        throw new Error(err.error || "Failed");
      }
      const { readSse } = await import("@/lib/sse-client");
      const full = await readSse(res, (event) => {
        if (event.type === "token" && event.text) {
          setVariants((v) => v + event.text);
        }
      });
      setVariants(full);
    } catch {
      /* ignore */
    } finally {
      setVarBusy(false);
    }
  }

  async function analyzeComp() {
    if (!compTitle.trim()) return;
    setCompBusy(true);
    try {
      await fetch("/api/ai/analyze-comp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          novelId,
          title: compTitle,
          author: compAuthor,
          notes: compNotes,
        }),
      });
      setCompTitle("");
      setCompAuthor("");
      setCompNotes("");
      onRefresh();
    } finally {
      setCompBusy(false);
    }
  }

  return (
    <div className="mb-8 space-y-6">
      <section className="rounded-lg border border-border bg-surface/50 p-4">
        <h2 className="font-serif text-xl">Style guide</h2>
        <p className="mt-1 text-xs text-muted">
          Teach the model your voice. AI proposes rules; you edit and approve before they affect
          drafting.
        </p>
        <textarea
          className="mt-3 w-full rounded-md border border-border bg-bg px-2 py-2 text-sm"
          rows={5}
          placeholder="Paste 2–5 of your best passages, separated by blank lines."
          value={samples}
          onChange={(e) => setSamples(e.target.value)}
        />
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!hasApiKey || styleBusy || !samples.trim()}
            className="rounded-md bg-accent px-3 py-1.5 text-xs text-bg disabled:opacity-50"
            onClick={() => void analyzeStyle()}
          >
            {styleBusy ? "Analyzing…" : "Analyze samples"}
          </button>
          <button
            type="button"
            className="rounded-md border border-border px-3 py-1.5 text-xs"
            onClick={() => {
              try {
                const parsed = JSON.parse(guideDraft || "{}") as Record<string, unknown>;
                void onPatch("updateNovel", {
                  styleGuideJson: JSON.stringify({ ...parsed, approved: true }),
                  styleSamplesJson: JSON.stringify(
                    samples
                      .split("\n\n")
                      .map((s) => s.trim())
                      .filter(Boolean)
                      .map((excerpt) => ({ excerpt })),
                  ),
                });
              } catch {
                /* invalid JSON */
              }
            }}
          >
            Approve & save
          </button>
        </div>
        <textarea
          className="mt-3 w-full rounded-md border border-border bg-bg px-2 py-2 font-mono text-xs"
          rows={8}
          value={guideDraft}
          onChange={(e) => setGuideDraft(e.target.value)}
        />
      </section>

      <section className="rounded-lg border border-border bg-surface/50 p-4">
        <h2 className="font-serif text-xl">Outline variants</h2>
        <p className="mt-1 text-xs text-muted">
          Choose among arrangements instead of staring at chaos. Nothing is applied until you ask
          the assistant to apply an option.
        </p>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            disabled={!hasApiKey || varBusy}
            className="rounded-md bg-accent px-3 py-1.5 text-xs text-bg disabled:opacity-50"
            onClick={() => void generateVariants()}
          >
            {varBusy ? "Drafting options…" : "Generate outline options"}
          </button>
          <button
            type="button"
            disabled={!hasApiKey || busy || !variants}
            className="rounded-md border border-border px-3 py-1.5 text-xs disabled:opacity-50"
            onClick={onVariants}
          >
            Ask assistant to apply a chosen option
          </button>
        </div>
        {variants ? (
          <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-bg p-2 text-xs">
            {variants}
          </pre>
        ) : null}
      </section>

      <section className="rounded-lg border border-border bg-surface/50 p-4">
        <h2 className="font-serif text-xl">Comparison books</h2>
        <p className="mt-1 text-xs text-muted">
          Learn the grammar of the genre. Do not copy plots — invent your own characters and
          details.
        </p>
        <input
          className="mt-3 w-full rounded-md border border-border bg-bg px-2 py-1 text-sm"
          placeholder="Title"
          value={compTitle}
          onChange={(e) => setCompTitle(e.target.value)}
        />
        <input
          className="mt-2 w-full rounded-md border border-border bg-bg px-2 py-1 text-sm"
          placeholder="Author"
          value={compAuthor}
          onChange={(e) => setCompAuthor(e.target.value)}
        />
        <textarea
          className="mt-2 w-full rounded-md border border-border bg-bg px-2 py-2 text-sm"
          rows={4}
          placeholder="Chapter notes or a short excerpt you have the right to paste…"
          value={compNotes}
          onChange={(e) => setCompNotes(e.target.value)}
        />
        <button
          type="button"
          disabled={!hasApiKey || compBusy || !compTitle.trim()}
          className="mt-2 rounded-md bg-accent px-3 py-1.5 text-xs text-bg disabled:opacity-50"
          onClick={() => void analyzeComp()}
        >
          {compBusy ? "Analyzing…" : "Analyze comp"}
        </button>
        <ul className="mt-4 space-y-3">
          {(data.comps ?? []).map((c) => (
            <li key={c.id} className="rounded-md border border-border bg-bg p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{c.title}</p>
                  {c.author ? <p className="text-xs text-muted">{c.author}</p> : null}
                </div>
                <button
                  type="button"
                  className="text-xs text-danger hover:underline"
                  onClick={() => void onPatch("deleteComp", { compId: c.id })}
                >
                  Delete
                </button>
              </div>
              {c.chapterBreakdownJson ? (
                <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-xs text-muted">
                  {c.chapterBreakdownJson}
                </pre>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
