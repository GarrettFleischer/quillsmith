"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SliderFields } from "@/components/slider-fields";
import { AI_TELLS, type AiTellId } from "@/lib/ai-tells";
import {
  densityDisclaimer,
  type DensityLevel,
  type DensityReport,
  type TellHit,
} from "@/lib/ai-tell-density";
import type { AiTaskId } from "@/lib/ai-tasks";
import {
  CHECKS,
  formatPlanMarkdown,
  type CheckId,
  type ImprovementPlan,
} from "@/lib/checks";
import { readSse } from "@/lib/sse-client";
import {
  CHARACTER_SLIDERS,
  SCENE_SLIDERS,
  parseSceneSliders,
  stringifySceneSliders,
  type SceneSliderState,
} from "@/lib/sliders";

export type CoachTab =
  | "interview"
  | "critique"
  | "practice"
  | "structure"
  | "beta"
  | "tells"
  | "checks"
  | "physics"
  | "layer";

const TABS: { id: CoachTab; label: string }[] = [
  { id: "interview", label: "Interview" },
  { id: "critique", label: "Critique" },
  { id: "practice", label: "Practice" },
  { id: "structure", label: "Structure" },
  { id: "beta", label: "Beta" },
  { id: "tells", label: "AI Tells" },
  { id: "checks", label: "Checks" },
  { id: "physics", label: "Physics" },
  { id: "layer", label: "Layer" },
];

const PERSONAS = [
  { id: "genre_fan", label: "Genre fan" },
  { id: "casual_reader", label: "Casual reader" },
  { id: "harsh_critic", label: "Harsh critic" },
];

type ChatTurn = { role: "user" | "assistant"; content: string };

export function CoachPanel({
  novelId,
  sceneId,
  chapterId,
  chapterTitle,
  beats,
  model,
  hasApiKey,
  onPromoteBeat,
  onSyncBeats,
  onDensity,
  onCollapse,
  sceneSlidersJson,
  characters,
  onSaveSceneSliders,
  className,
}: {
  novelId: string;
  sceneId: string | null;
  chapterId: string | null;
  chapterTitle?: string;
  beats: Array<{ content: string }>;
  model: string;
  hasApiKey: boolean;
  onPromoteBeat?: (content: string) => void;
  onSyncBeats?: (contents: string[]) => void;
  onDensity?: (level: DensityLevel | null) => void;
  onCollapse?: () => void;
  sceneSlidersJson?: string | null;
  characters?: Array<{ id: string; name: string; slidersJson?: string | null }>;
  onSaveSceneSliders?: (json: string) => void;
  className?: string;
}) {
  const [tab, setTab] = useState<CoachTab>("interview");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState("");
  const [history, setHistory] = useState<ChatTurn[]>([]);
  const [exemplar, setExemplar] = useState("");
  const [persona, setPersona] = useState("genre_fan");
  const [customPersona, setCustomPersona] = useState("");
  const [report, setReport] = useState<DensityReport | null>(null);
  const [selectedTell, setSelectedTell] = useState<AiTellId>("brochure_language");
  const [hits, setHits] = useState<TellHit[]>([]);
  const [buckets, setBuckets] = useState<Record<number, "fix" | "investigate" | "ignore">>({});
  const [rewriteDraft, setRewriteDraft] = useState("");
  const [structureText, setStructureText] = useState("");
  const [selectedCheck, setSelectedCheck] = useState<CheckId>("adverbs");
  const [plan, setPlan] = useState<ImprovementPlan | null>(null);
  const [seriesPlans, setSeriesPlans] = useState<ImprovementPlan[]>([]);
  const [sceneSliders, setSceneSliders] = useState<SceneSliderState>(() =>
    parseSceneSliders(sceneSlidersJson),
  );

  useEffect(() => {
    setSceneSliders(parseSceneSliders(sceneSlidersJson));
  }, [sceneSlidersJson, sceneId]);

  const resetThread = useCallback(() => {
    setHistory([]);
    setStreaming("");
    setInput("");
    setError("");
  }, []);

  async function streamTask(task: AiTaskId, extra: Record<string, unknown> = {}) {
    if (!hasApiKey) return "";
    setBusy(true);
    setError("");
    setStreaming("");
    setStatus("Working…");
    try {
      const res = await fetch("/api/ai/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task,
          novelId,
          sceneId,
          chapterId,
          model,
          ...extra,
        }),
      });
      const ctype = res.headers.get("content-type") || "";
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed" }));
        throw new Error(err.error || "Coach request failed");
      }
      if (ctype.includes("application/json")) {
        const data = (await res.json()) as {
          report?: DensityReport;
          plan?: ImprovementPlan;
          physics?: {
            tension?: number;
            spice?: number;
            characters?: Array<{ name: string; stress_harmony?: number }>;
          };
          raw?: string;
        };
        if (data.report) {
          setReport(data.report);
          setHits(data.report.hits);
          onDensity?.(data.report.level);
        }
        if (data.plan) setPlan(data.plan);
        if (data.physics) {
          setSceneSliders((prev) => {
            const next: SceneSliderState = {
              ...prev,
              tension: data.physics?.tension ?? prev.tension,
              spice: data.physics?.spice ?? prev.spice,
              characters: { ...prev.characters },
            };
            for (const row of data.physics?.characters ?? []) {
              const match = (characters ?? []).find(
                (c) => c.name.toLowerCase() === row.name.toLowerCase(),
              );
              if (!match) continue;
              next.characters = {
                ...next.characters,
                [match.id]: {
                  ...(next.characters?.[match.id] ?? {}),
                  stress_harmony: row.stress_harmony ?? 0,
                },
              };
            }
            return next;
          });
        }
        setStatus("");
        return data.raw || "";
      }
      const full = await readSse(res, (event) => {
        if (event.type === "token" && event.text) {
          setStreaming((prev) => prev + event.text);
        }
        if (event.type === "status" && event.message) setStatus(event.message);
      });
      setStatus("");
      return full;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      setStatus("");
      return "";
    } finally {
      setBusy(false);
    }
  }

  async function sendInterview() {
    const message = input.trim() || "I'm stuck. Interview me.";
    const nextHistory = [...history, { role: "user" as const, content: message }];
    setHistory(nextHistory);
    setInput("");
    const reply = await streamTask("coach_interview", {
      message,
      history,
    });
    if (reply) {
      setHistory([...nextHistory, { role: "assistant", content: reply }]);
      setStreaming("");
    }
  }

  async function runFeedback(task: AiTaskId, extra: Record<string, unknown> = {}) {
    const reply = await streamTask(task, extra);
    if (reply) {
      setHistory([{ role: "assistant", content: reply }]);
      setStreaming("");
      if (task === "coach_reverse_outline") setStructureText(reply);
    }
  }

  const levelLabel = report
    ? report.level === "high"
      ? "HIGH"
      : report.level === "elevated"
        ? "ELEVATED"
        : "LOW"
    : null;

  const maxBar = useMemo(() => {
    const m = Math.max(1, ...(report?.byTell.map((t) => t.count) ?? [1]));
    return m;
  }, [report]);

  return (
    <aside
      className={`flex h-full min-h-0 w-[300px] shrink-0 flex-col border-l border-border bg-surface/70 panel-enter ${className ?? ""}`}
    >
      <div className="border-b border-border px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="font-serif text-lg">Coach</h2>
            <p className="text-[11px] text-muted">You remain the author</p>
          </div>
          {onCollapse ? (
            <button
              type="button"
              className="text-xs text-muted hover:underline"
              onClick={onCollapse}
            >
              Hide
            </button>
          ) : null}
        </div>
        <p className="mt-1 text-xs text-muted">{chapterTitle || "Place the cursor in a scene"}</p>
        <div className="mt-2 flex flex-wrap gap-0.5">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`rounded px-1.5 py-0.5 text-[11px] ${
                tab === t.id ? "bg-accent-soft text-accent" : "text-muted hover:text-text"
              }`}
              onClick={() => {
                setTab(t.id);
                resetThread();
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-3 text-sm">
        {!hasApiKey ? (
          <p className="text-xs text-muted">Add an OpenRouter key in Settings to use Coach.</p>
        ) : null}

        {tab === "interview" ? (
          <div className="space-y-2">
            <p className="text-xs text-muted">
              Answer as you would a curious friend. Coach will not draft the scene.
            </p>
            {history.map((m, i) => (
              <div
                key={`${m.role}-${i}`}
                className={`rounded-md p-2 ${
                  m.role === "user" ? "bg-accent-soft" : "border border-border bg-bg"
                }`}
              >
                <p className="mb-1 text-[10px] uppercase text-muted">
                  {m.role === "user" ? "You" : "Coach"}
                </p>
                <p className="whitespace-pre-wrap">{m.content}</p>
              </div>
            ))}
            {streaming ? (
              <p className="whitespace-pre-wrap text-muted">{streaming}</p>
            ) : null}
            {onPromoteBeat ? (
              <button
                type="button"
                className="text-xs text-accent hover:underline"
                disabled={!history.some((h) => h.role === "user")}
                onClick={() => {
                  const answers = history
                    .filter((h) => h.role === "user")
                    .map((h) => h.content)
                    .join(" / ");
                  onPromoteBeat(answers.slice(0, 500));
                }}
              >
                Promote my answers to a beat
              </button>
            ) : null}
          </div>
        ) : null}

        {tab === "critique" ? (
          <div className="space-y-2">
            <p className="text-xs text-muted">
              Possible problems to investigate — not a verdict. No rewrite from this tab.
            </p>
            <button
              type="button"
              disabled={busy || !sceneId || !hasApiKey}
              className="rounded-md bg-accent px-2 py-1 text-xs text-bg disabled:opacity-50"
              onClick={() => void runFeedback("coach_critique")}
            >
              Critique this scene
            </button>
            <FeedbackBody streaming={streaming} history={history} />
          </div>
        ) : null}

        {tab === "practice" ? (
          <div className="space-y-2">
            <p className="text-xs text-muted">
              Paste an admired passage. Output stays in a scratch area — not the manuscript.
            </p>
            <textarea
              className="w-full rounded-md border border-border bg-bg px-2 py-1 text-xs"
              rows={5}
              placeholder="Exemplar passage…"
              value={exemplar}
              onChange={(e) => setExemplar(e.target.value)}
            />
            <button
              type="button"
              disabled={busy || !hasApiKey || !exemplar.trim()}
              className="rounded-md bg-accent px-2 py-1 text-xs text-bg disabled:opacity-50"
              onClick={() => void runFeedback("coach_tutor", { exemplar })}
            >
              Compare & assign an exercise
            </button>
            <FeedbackBody streaming={streaming} history={history} scratch />
          </div>
        ) : null}

        {tab === "structure" ? (
          <div className="space-y-2">
            <p className="text-xs text-muted">
              Reverse-outline this chapter vs planned beats.
            </p>
            <p className="text-[11px] text-muted">
              Planned: {beats.length ? beats.map((b) => b.content).join(" · ") : "(none)"}
            </p>
            <button
              type="button"
              disabled={busy || !chapterId || !hasApiKey}
              className="rounded-md bg-accent px-2 py-1 text-xs text-bg disabled:opacity-50"
              onClick={() => void runFeedback("coach_reverse_outline")}
            >
              Reverse outline
            </button>
            <FeedbackBody streaming={streaming} history={history} />
            {onSyncBeats && structureText ? (
              <button
                type="button"
                className="text-xs text-accent hover:underline"
                onClick={() => {
                  const lines = structureText
                    .split("\n")
                    .map((l) => l.replace(/^\d+\.\s*/, "").replace(/^[-*]\s*/, "").trim())
                    .filter((l) => l.length > 8 && l.length < 280)
                    .slice(0, 12);
                  if (lines.length) onSyncBeats(lines);
                }}
              >
                Sync beats from reverse outline
              </button>
            ) : null}
          </div>
        ) : null}

        {tab === "beta" ? (
          <div className="space-y-2">
            <p className="text-xs text-muted">
              Simulated readers. Possible problems to investigate — you decide what is real.
            </p>
            <select
              className="w-full rounded-md border border-border bg-bg px-2 py-1 text-xs"
              value={persona}
              onChange={(e) => setPersona(e.target.value)}
            >
              {PERSONAS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
              <option value="custom">Custom</option>
            </select>
            {persona === "custom" ? (
              <input
                className="w-full rounded-md border border-border bg-bg px-2 py-1 text-xs"
                placeholder="Describe the reader…"
                value={customPersona}
                onChange={(e) => setCustomPersona(e.target.value)}
              />
            ) : null}
            <button
              type="button"
              disabled={busy || !hasApiKey}
              className="rounded-md bg-accent px-2 py-1 text-xs text-bg disabled:opacity-50"
              onClick={() =>
                void runFeedback("coach_beta", {
                  persona: persona === "custom" ? customPersona || "custom" : persona,
                })
              }
            >
              Ask this reader
            </button>
            <FeedbackBody streaming={streaming} history={history} />
          </div>
        ) : null}

        {tab === "tells" ? (
          <div className="space-y-3">
            <p className="text-[11px] leading-relaxed text-muted">{densityDisclaimer()}</p>
            {report ? (
              <div>
                <p className="text-xs font-medium">
                  Pattern density — {report.wordCount} words · {levelLabel} ({report.totalHits})
                </p>
                <ul className="mt-2 space-y-1">
                  {report.byTell.map((t) => (
                    <li key={t.id} className="flex items-center gap-2 text-[11px]">
                      <span className="w-28 truncate text-muted">{t.label}</span>
                      <span className="h-1.5 flex-1 rounded bg-border">
                        <span
                          className={`block h-1.5 rounded ${
                            t.level === "high"
                              ? "bg-danger"
                              : t.level === "elevated"
                                ? "bg-accent"
                                : "bg-muted"
                          }`}
                          style={{ width: `${Math.min(100, (t.count / maxBar) * 100)}%` }}
                        />
                      </span>
                      <span className="w-4 text-right">{t.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-xs text-muted">Scan density first — counts, not an AI score.</p>
            )}
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                disabled={busy || !sceneId || !hasApiKey}
                className="rounded-md bg-accent px-2 py-1 text-xs text-bg disabled:opacity-50"
                onClick={() => void streamTask("analyze_density")}
              >
                Scan density
              </button>
            </div>
            <label className="block text-[11px] text-muted">
              Scan one tell
              <select
                className="mt-1 w-full rounded-md border border-border bg-bg px-2 py-1 text-xs text-text"
                value={selectedTell}
                onChange={(e) => setSelectedTell(e.target.value as AiTellId)}
              >
                {AI_TELLS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={busy || !sceneId || !hasApiKey}
              className="rounded-md border border-border px-2 py-1 text-xs disabled:opacity-50"
              onClick={() => void streamTask(`scrub_${selectedTell}` as AiTaskId)}
            >
              Scan {AI_TELLS.find((t) => t.id === selectedTell)?.label}
            </button>
            {hits.length ? (
              <ul className="space-y-2">
                {hits.map((h, i) => (
                  <li key={`${h.pattern}-${i}`} className="rounded-md border border-border bg-bg p-2">
                    <p className="text-[11px] text-accent">{h.pattern}</p>
                    <p className="mt-1 text-xs italic">&ldquo;{h.quote}&rdquo;</p>
                    <p className="mt-1 text-[11px] text-muted">{h.why}</p>
                    {h.suggestion ? (
                      <p className="mt-1 text-[11px]">{h.suggestion}</p>
                    ) : null}
                    <div className="mt-1 flex gap-2 text-[11px]">
                      {(["fix", "investigate", "ignore"] as const).map((b) => (
                        <button
                          key={b}
                          type="button"
                          className={buckets[i] === b ? "text-accent" : "text-muted"}
                          onClick={() => setBuckets((prev) => ({ ...prev, [i]: b }))}
                        >
                          {b}
                        </button>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="text-[11px] text-muted">
              Lines you accept from an AI rewrite become AI-assisted prose. Prefer fixing flagged
              lines yourself.
            </p>
            <button
              type="button"
              disabled={busy || !sceneId || !hasApiKey}
              className="rounded-md border border-border px-2 py-1 text-xs disabled:opacity-50"
              onClick={async () => {
                const text = await streamTask(`scrub_${selectedTell}` as AiTaskId, {
                  scrubMode: "rewrite",
                  persist: false,
                });
                if (text) setRewriteDraft(text);
              }}
            >
              Propose cleanup (this tell only)
            </button>
            {rewriteDraft ? (
              <textarea
                className="w-full rounded-md border border-border bg-bg px-2 py-1 font-serif text-xs"
                rows={8}
                value={rewriteDraft}
                onChange={(e) => setRewriteDraft(e.target.value)}
              />
            ) : streaming && tab === "tells" ? (
              <p className="whitespace-pre-wrap text-xs text-muted">{streaming}</p>
            ) : null}
          </div>
        ) : null}

        {tab === "checks" ? (
          <div className="space-y-2">
            <p className="text-[11px] leading-relaxed text-muted">
              Expand runs these checks on new prose automatically (plan, then apply only that plan).
              Use this tab to inspect a scene without drafting.
            </p>
            <select
              className="w-full rounded-md border border-border bg-bg px-2 py-1 text-xs"
              value={selectedCheck}
              onChange={(e) => {
                setSelectedCheck(e.target.value as CheckId);
                setPlan(null);
              }}
            >
              {CHECKS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={busy || !sceneId || !hasApiKey}
              className="rounded-md bg-accent px-2 py-1 text-xs text-bg disabled:opacity-50"
              onClick={async () => {
                setSeriesPlans([]);
                await streamTask(`check_${selectedCheck}` as AiTaskId);
              }}
            >
              Build improvement plan
            </button>
            <button
              type="button"
              disabled={busy || !sceneId || !hasApiKey}
              className="ml-1 rounded-md border border-border px-2 py-1 text-xs disabled:opacity-50"
              onClick={async () => {
                if (!hasApiKey || !sceneId) return;
                setBusy(true);
                setError("");
                setSeriesPlans([]);
                setPlan(null);
                const collected: ImprovementPlan[] = [];
                try {
                  for (const check of CHECKS) {
                    setStatus(`Check: ${check.label}`);
                    const res = await fetch("/api/ai/coach", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        task: `check_${check.id}`,
                        novelId,
                        sceneId,
                        chapterId,
                        model,
                        persist: false,
                      }),
                    });
                    if (!res.ok) continue;
                    const data = (await res.json()) as { plan?: ImprovementPlan };
                    if (data.plan?.items.length) collected.push(data.plan);
                  }
                  setSeriesPlans(collected);
                  setPlan(collected[0] ?? null);
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Failed");
                } finally {
                  setBusy(false);
                  setStatus("");
                }
              }}
            >
              Run all four checks
            </button>
            {seriesPlans.length > 0 ? (
              <div className="space-y-2">
                {seriesPlans.map((p) => (
                  <pre
                    key={p.checkId}
                    className="whitespace-pre-wrap rounded-md border border-border bg-bg p-2 text-[11px]"
                  >
                    {CHECKS.find((c) => c.id === p.checkId)?.label}
                    {"\n"}
                    {formatPlanMarkdown(p)}
                  </pre>
                ))}
              </div>
            ) : plan ? (
              <pre className="whitespace-pre-wrap rounded-md border border-border bg-bg p-2 text-[11px]">
                {formatPlanMarkdown(plan)}
              </pre>
            ) : null}
            {seriesPlans.length > 1 ? (
              <p className="text-[11px] text-muted">
                {seriesPlans.reduce((n, p) => n + p.items.length, 0)} items across {seriesPlans.length}{" "}
                checks.
              </p>
            ) : null}
            <p className="text-[11px] text-muted">
              Apply stays a proposal here. Use /check-* in the editor, then Apply plan, to review hunks
              in the manuscript.
            </p>
            <button
              type="button"
              disabled={busy || !sceneId || !hasApiKey || !plan?.items.length}
              className="rounded-md border border-border px-2 py-1 text-xs disabled:opacity-50"
              onClick={async () => {
                const merged =
                  seriesPlans.length > 0
                    ? {
                        checkId: selectedCheck,
                        items: seriesPlans.flatMap((p) => p.items),
                      }
                    : plan;
                const text = await streamTask("check_apply", {
                  checkMode: "apply",
                  improvementPlan: JSON.stringify(merged),
                  persist: false,
                });
                if (text) setRewriteDraft(text);
              }}
            >
              Propose apply (plan only)
            </button>
            {rewriteDraft && tab === "checks" ? (
              <textarea
                className="w-full rounded-md border border-border bg-bg px-2 py-1 font-serif text-xs"
                rows={8}
                value={rewriteDraft}
                onChange={(e) => setRewriteDraft(e.target.value)}
              />
            ) : streaming && tab === "checks" ? (
              <p className="whitespace-pre-wrap text-xs text-muted">{streaming}</p>
            ) : null}
          </div>
        ) : null}

        {tab === "physics" ? (
          <div className="space-y-3">
            <p className="text-[11px] leading-relaxed text-muted">
              Expand sets these for the scene if they are empty. Edit here to lock author intent
              before the next draft.
            </p>
            <SliderFields
              defs={SCENE_SLIDERS}
              values={{
                tension: sceneSliders.tension ?? 5,
                spice: sceneSliders.spice ?? 0,
              }}
              onChange={(id, value) =>
                setSceneSliders((prev) => ({ ...prev, [id]: value }))
              }
            />
            {(characters ?? []).map((c) => (
              <div key={c.id} className="rounded-md border border-border p-2">
                <p className="mb-1 text-[11px] font-medium">{c.name}</p>
                <SliderFields
                  defs={CHARACTER_SLIDERS}
                  values={sceneSliders.characters?.[c.id] ?? {}}
                  onChange={(id, value) =>
                    setSceneSliders((prev) => ({
                      ...prev,
                      characters: {
                        ...prev.characters,
                        [c.id]: { ...(prev.characters?.[c.id] ?? {}), [id]: value },
                      },
                    }))
                  }
                />
              </div>
            ))}
            <button
              type="button"
              disabled={!sceneId || !onSaveSceneSliders}
              className="rounded-md bg-accent px-2 py-1 text-xs text-bg disabled:opacity-50"
              onClick={() => onSaveSceneSliders?.(stringifySceneSliders(sceneSliders))}
            >
              Save scene sliders
            </button>
            <button
              type="button"
              disabled={busy || !sceneId || !hasApiKey}
              className="ml-1 rounded-md border border-border px-2 py-1 text-xs disabled:opacity-50"
              onClick={() => void streamTask("coach_physics")}
            >
              Propose from scene
            </button>
          </div>
        ) : null}

        {tab === "layer" ? (
          <div className="space-y-2">
            <p className="text-[11px] leading-relaxed text-muted">
              Expand already runs this pipeline when you draft. This tab previews the brief only.
              Per-step models live in Settings.
            </p>
            <button
              type="button"
              disabled={busy || !sceneId || !hasApiKey}
              className="rounded-md bg-accent px-2 py-1 text-xs text-bg disabled:opacity-50"
              onClick={() => void runFeedback("layer_brief")}
            >
              Preview scene brief
            </button>
            <FeedbackBody streaming={streaming} history={history} scratch />
          </div>
        ) : null}

        {status ? <p className="mt-2 text-xs text-accent">{status}</p> : null}
        {error ? (
          <p className="mt-2 rounded-md border border-border bg-bg px-2 py-1 text-xs text-danger">
            {error}
          </p>
        ) : null}
      </div>

      {tab === "interview" ? (
        <div className="border-t border-border p-3">
          <textarea
            className="w-full rounded-md border border-border bg-bg px-2 py-1 text-sm disabled:opacity-50"
            rows={3}
            placeholder="Answer, or ask to start…"
            value={input}
            disabled={!hasApiKey || busy}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void sendInterview();
              }
            }}
          />
          <button
            type="button"
            disabled={!hasApiKey || busy}
            className="mt-2 w-full rounded-md bg-accent py-1.5 text-xs text-bg disabled:opacity-50"
            onClick={() => void sendInterview()}
          >
            {busy ? "Working…" : "Send"}
          </button>
        </div>
      ) : null}
    </aside>
  );
}

function FeedbackBody({
  streaming,
  history,
  scratch,
}: {
  streaming: string;
  history: ChatTurn[];
  scratch?: boolean;
}) {
  const text = streaming || history.map((h) => h.content).join("\n\n");
  if (!text) return null;
  return (
    <div
      className={`whitespace-pre-wrap rounded-md border border-border p-2 text-xs ${
        scratch ? "bg-bg font-serif" : "bg-bg"
      }`}
    >
      {scratch ? <p className="mb-1 text-[10px] uppercase text-muted">Scratch</p> : null}
      {text}
    </div>
  );
}
