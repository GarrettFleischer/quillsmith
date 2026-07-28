"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { QUESTION_BANK } from "@/lib/question-bank";

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
  };
  acts: Array<{
    id: string;
    title: string;
    brief: string | null;
    introduces: string | null;
    accomplishes: string | null;
    losses: string | null;
    stateStart: string | null;
    stateEnd: string | null;
    chapters: Array<{
      id: string;
      title: string;
      goal: string | null;
      beats: Array<{ id: string; content: string }>;
      scenes: Array<{ id: string }>;
    }>;
  }>;
  overviewMessages: Array<{ id: string; role: string; content: string }>;
  overviewAnswers: Array<{ questionId: string; answer: string }>;
};

export default function OverviewPage() {
  const params = useParams<{ id: string }>();
  const novelId = params.id;
  const [data, setData] = useState<Tree | null>(null);
  const [mode, setMode] = useState<"fill" | "review">("fill");
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/novels/${novelId}`);
    setData(await res.json());
  }, [novelId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const answered = useMemo(
    () => new Set(data?.overviewAnswers.map((a) => a.questionId) ?? []),
    [data],
  );

  async function patch(action: string, payload: Record<string, unknown>) {
    await fetch(`/api/novels/${novelId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, payload }),
    });
    await refresh();
  }

  async function sendChat(message: string) {
    if (!message.trim()) return;
    setBusy(true);
    setStreaming("");
    setStatus("Thinking…");
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
          if (event.type === "status") setStatus(event.message || "");
          if (event.type === "tool") setStatus(`Updating outline… (${event.name})`);
          if (event.type === "error") throw new Error(event.message);
        }
      }
      setInput("");
      await refresh();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
      setStreaming("");
      setStatus("");
    }
  }

  if (!data) {
    return (
      <div>
        <AppHeader />
        <p className="p-8 text-muted">Loading overview…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader novelId={novelId} novelTitle={data.novel.title} mode="overview" />
      <div className="mx-auto grid min-h-0 w-full max-w-[1600px] flex-1 grid-cols-1 gap-0 lg:grid-cols-[1fr_380px]">
        <section className="overflow-y-auto border-r border-border p-6">
          <div className="mb-6">
            <input
              className="w-full bg-transparent font-display text-4xl outline-none"
              value={data.novel.title}
              onChange={(e) =>
                setData((d) => (d ? { ...d, novel: { ...d.novel, title: e.target.value } } : d))
              }
              onBlur={(e) => void patch("updateNovel", { title: e.target.value })}
            />
            <textarea
              className="mt-3 w-full rounded border border-border bg-surface px-3 py-2 text-sm"
              rows={3}
              placeholder="Premise"
              value={data.novel.premise ?? ""}
              onChange={(e) =>
                setData((d) =>
                  d ? { ...d, novel: { ...d.novel, premise: e.target.value } } : d,
                )
              }
              onBlur={(e) => void patch("updateNovel", { premise: e.target.value })}
            />
          </div>

          <div className="mb-4 flex gap-2">
            <button
              type="button"
              className="rounded bg-accent px-3 py-1.5 text-sm text-bg"
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

          {data.acts.map((act) => (
            <article key={act.id} className="mb-8 rounded-lg border border-border bg-surface/50 p-4">
              <input
                className="w-full bg-transparent font-serif text-2xl outline-none"
                value={act.title}
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
                onBlur={(e) =>
                  void patch("upsertAct", { id: act.id, title: e.target.value })
                }
              />
              <textarea
                className="mt-2 w-full rounded border border-border bg-bg px-2 py-2 text-sm"
                rows={3}
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
                  void patch("upsertAct", {
                    id: act.id,
                    title: act.title,
                    brief: e.target.value,
                  })
                }
              />
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {(
                  [
                    ["introduces", "Introduces"],
                    ["accomplishes", "Accomplishes"],
                    ["losses", "Losses"],
                    ["stateStart", "State start"],
                    ["stateEnd", "State end"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="text-xs text-muted">
                    {label}
                    <input
                      className="mt-1 w-full rounded border border-border bg-bg px-2 py-1 text-sm text-text"
                      value={(act[key] as string) ?? ""}
                      onBlur={(e) =>
                        void patch("upsertAct", {
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

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  className="text-xs text-accent hover:underline"
                  onClick={() =>
                    void patch("upsertChapter", {
                      actId: act.id,
                      title: `Chapter ${act.chapters.length + 1}`,
                    })
                  }
                >
                  + Chapter
                </button>
                <button
                  type="button"
                  className="text-xs text-danger hover:underline"
                  onClick={() => void patch("deleteAct", { actId: act.id })}
                >
                  Delete act
                </button>
                <button
                  type="button"
                  className="text-xs text-muted hover:underline"
                  onClick={() =>
                    void sendChat(`Help me fill this act: ${act.title} (id ${act.id}).`)
                  }
                >
                  Help fill this act
                </button>
              </div>

              <ul className="mt-4 space-y-3">
                {act.chapters.map((ch) => (
                  <li key={ch.id} className="rounded border border-border bg-bg p-3">
                    <input
                      className="w-full bg-transparent font-medium outline-none"
                      value={ch.title}
                      onBlur={(e) =>
                        void patch("upsertChapter", {
                          id: ch.id,
                          actId: act.id,
                          title: e.target.value,
                          goal: ch.goal,
                        })
                      }
                      onChange={(e) =>
                        setData((d) =>
                          d
                            ? {
                                ...d,
                                acts: d.acts.map((a) =>
                                  a.id === act.id
                                    ? {
                                        ...a,
                                        chapters: a.chapters.map((c) =>
                                          c.id === ch.id
                                            ? { ...c, title: e.target.value }
                                            : c,
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
                      className="mt-2 w-full rounded border border-border bg-surface px-2 py-1 text-sm"
                      rows={2}
                      placeholder="Chapter goal (milestone toward the act)"
                      value={ch.goal ?? ""}
                      onBlur={(e) =>
                        void patch("upsertChapter", {
                          id: ch.id,
                          actId: act.id,
                          title: ch.title,
                          goal: e.target.value,
                        })
                      }
                      onChange={(e) =>
                        setData((d) =>
                          d
                            ? {
                                ...d,
                                acts: d.acts.map((a) =>
                                  a.id === act.id
                                    ? {
                                        ...a,
                                        chapters: a.chapters.map((c) =>
                                          c.id === ch.id
                                            ? { ...c, goal: e.target.value }
                                            : c,
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
                      Beats: {ch.beats.length} · Scenes: {ch.scenes.length} (siblings under
                      chapter)
                    </p>
                    <ul className="mt-2 space-y-1 text-sm text-muted">
                      {ch.beats.map((b, i) => (
                        <li key={b.id}>
                          {i + 1}. {b.content}
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      className="mt-2 text-xs text-accent hover:underline"
                      onClick={() =>
                        void patch("upsertBeat", {
                          chapterId: ch.id,
                          content: "New beat detail",
                        })
                      }
                    >
                      + Beat
                    </button>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </section>

        <aside className="flex max-h-[calc(100vh-3.5rem)] flex-col overflow-hidden bg-surface/60">
          <div className="border-b border-border p-3">
            <div className="flex gap-2">
              <button
                type="button"
                className={`rounded px-2 py-1 text-sm ${mode === "fill" ? "bg-accent-soft text-accent" : "text-muted"}`}
                onClick={() => setMode("fill")}
              >
                Fill
              </button>
              <button
                type="button"
                className={`rounded px-2 py-1 text-sm ${mode === "review" ? "bg-accent-soft text-accent" : "text-muted"}`}
                onClick={() => setMode("review")}
              >
                Review
              </button>
              <button
                type="button"
                className="ml-auto text-xs text-muted hover:underline"
                onClick={() => void sendChat("Review the whole outline for coherence.")}
              >
                Review whole outline
              </button>
            </div>
            <p className="mt-2 text-xs text-muted">
              Checklist {answered.size}/{QUESTION_BANK.length}
            </p>
            <div className="mt-2 max-h-36 space-y-1 overflow-auto">
              {QUESTION_BANK.map((q) => (
                <button
                  key={q.id}
                  type="button"
                  className={`block w-full truncate rounded px-2 py-1 text-left text-xs ${
                    answered.has(q.id) ? "text-accent" : "text-muted hover:bg-bg"
                  }`}
                  onClick={() =>
                    void sendChat(`Let's work on ${q.id}: ${q.prompt}`)
                  }
                >
                  {answered.has(q.id) ? "✓" : "○"} {q.id}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 space-y-3 overflow-auto p-3 text-sm">
            {data.overviewMessages.map((m) => (
              <div
                key={m.id}
                className={`rounded p-2 ${
                  m.role === "user" ? "bg-accent-soft" : "bg-bg border border-border"
                }`}
              >
                <p className="mb-1 text-[10px] uppercase tracking-wide text-muted">
                  {m.role}
                </p>
                <p className="whitespace-pre-wrap">{m.content}</p>
              </div>
            ))}
            {streaming ? (
              <div className="rounded border border-border bg-bg p-2 whitespace-pre-wrap text-muted">
                {streaming}
              </div>
            ) : null}
            {status ? <p className="text-xs text-accent">{status}</p> : null}
          </div>

          <div className="border-t border-border p-3">
            <textarea
              className="w-full rounded border border-border bg-bg px-2 py-2 text-sm"
              rows={3}
              placeholder="Ask the overview helper…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void sendChat(input);
                }
              }}
            />
            <button
              type="button"
              disabled={busy}
              className="mt-2 w-full rounded bg-accent py-2 text-sm text-bg disabled:opacity-50"
              onClick={() => void sendChat(input)}
            >
              {busy ? "Working…" : "Send"}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
