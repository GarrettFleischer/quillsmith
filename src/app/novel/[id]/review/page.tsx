"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import type { DensityReport } from "@/lib/ai-tell-density";
import { densityDisclaimer, wordCount } from "@/lib/ai-tell-density";
import { CHECKS, type ImprovementPlan } from "@/lib/checks";
import { plainFromTipTap } from "@/lib/utils";

type Tree = {
  novel: { id: string; title: string };
  acts: Array<{
    id: string;
    title: string;
    chapters: Array<{
      id: string;
      title: string;
      prose: { id: string; content: string } | null;
      scenes: Array<{ id: string; content: string }>;
    }>;
  }>;
};

export default function ReviewPage() {
  const params = useParams<{ id: string }>();
  const novelId = params.id;
  const [data, setData] = useState<Tree | null>(null);
  const [chapterId, setChapterId] = useState("");
  const [scope, setScope] = useState<"chapter" | "book">("chapter");
  const [model, setModel] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [report, setReport] = useState<DensityReport | null>(null);
  const [plans, setPlans] = useState<ImprovementPlan[]>([]);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/novels/${novelId}`);
    if (!res.ok) return;
    const tree = (await res.json()) as Tree;
    setData(tree);
    setChapterId((current) => {
      if (current) return current;
      return tree.acts[0]?.chapters[0]?.id ?? "";
    });
  }, [novelId]);

  useEffect(() => {
    void refresh();
    void fetch("/api/settings")
      .then((r) => r.json())
      .then((s) => setModel(s.settings?.defaultModel ?? ""));
  }, [refresh]);

  const chapters = useMemo(() => {
    if (!data) return [];
    return data.acts.flatMap((a) =>
      a.chapters.map((c) => ({
        id: c.id,
        label: `${a.title} / ${c.title}`,
        prose: c.prose ?? c.scenes[0] ?? null,
      })),
    );
  }, [data]);

  const passage = useMemo(() => {
    if (!data) return "";
    if (scope === "book") {
      return chapters
        .map((c) => plainFromTipTap(c.prose?.content ?? ""))
        .filter(Boolean)
        .join("\n\n");
    }
    const ch = chapters.find((c) => c.id === chapterId);
    return plainFromTipTap(ch?.prose?.content ?? "");
  }, [data, scope, chapterId, chapters]);

  const proseId = chapters.find((c) => c.id === chapterId)?.prose?.id ?? null;
  const words = wordCount(passage);

  async function scanDensity() {
    if (!proseId && scope === "chapter") return;
    setBusy("density");
    setError("");
    try {
      const res = await fetch("/api/ai/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: "analyze_density",
          novelId,
          sceneId: proseId,
          chapterId,
          passage,
          model,
          persist: false,
        }),
      });
      const dataJson = await res.json();
      if (!res.ok) throw new Error(dataJson.error || "Scan failed");
      setReport(dataJson.report);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setBusy("");
    }
  }

  async function runChecks() {
    if (!proseId && scope === "chapter") return;
    setBusy("checks");
    setError("");
    const next: ImprovementPlan[] = [];
    try {
      for (const check of CHECKS) {
        const res = await fetch("/api/ai/coach", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            task: `check_${check.id}`,
            novelId,
            sceneId: proseId,
            chapterId,
            passage,
            model,
            persist: false,
          }),
        });
        const dataJson = await res.json();
        if (!res.ok) throw new Error(dataJson.error || "Check failed");
        if (dataJson.plan) next.push(dataJson.plan);
      }
      setPlans(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checks failed");
    } finally {
      setBusy("");
    }
  }

  if (!data) {
    return (
      <div className="flex min-h-dvh flex-col">
        <AppHeader />
        <p className="p-8 text-muted">Loading review…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader novelId={novelId} novelTitle={data.novel.title} mode="review" />
      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        <h1 className="font-display text-4xl">Review</h1>
        <p className="mt-2 max-w-prose text-sm text-muted">
          Counts and suggestions for this chapter or the whole book. Pattern density is not an AI
          score. {densityDisclaimer()}
        </p>

        <div className="mt-6 flex flex-wrap items-end gap-3">
          <label className="text-xs text-muted">
            Scope
            <select
              className="mt-1 block rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-text"
              value={scope}
              onChange={(e) => setScope(e.target.value as "chapter" | "book")}
            >
              <option value="chapter">This chapter</option>
              <option value="book">Whole book</option>
            </select>
          </label>
          {scope === "chapter" ? (
            <label className="text-xs text-muted">
              Chapter
              <select
                className="mt-1 block max-w-[16rem] rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-text"
                value={chapterId}
                onChange={(e) => setChapterId(e.target.value)}
              >
                {chapters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>

        <section className="mt-8 rounded-md border border-border bg-surface p-4">
          <p className="font-serif text-xl">{words} words</p>
          <p className="mt-1 text-sm text-muted">
            {scope === "book" ? "All chapters concatenated" : "Current chapter"}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-md bg-accent px-3 py-1.5 text-sm text-bg disabled:opacity-50"
              disabled={Boolean(busy) || words === 0}
              onClick={() => void scanDensity()}
            >
              {busy === "density" ? "Scanning…" : "Scan density"}
            </button>
            <button
              type="button"
              className="rounded-md border border-border px-3 py-1.5 text-sm disabled:opacity-50"
              disabled={Boolean(busy) || words === 0}
              onClick={() => void runChecks()}
            >
              {busy === "checks" ? "Checking…" : "Generate suggestions"}
            </button>
            <Link href={`/novel/${novelId}`} className="rounded-md border border-border px-3 py-1.5 text-sm">
              Back to Write
            </Link>
          </div>
          {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
        </section>

        {report ? (
          <section className="mt-6 rounded-md border border-border bg-surface p-4">
            <h2 className="font-serif text-xl">Density</h2>
            <p className="mt-1 text-sm">
              Level: <span className={report.level === "high" ? "text-danger" : "text-accent"}>{report.level}</span>
              {" · "}
              {report.totalHits} hits · {report.hitsPer1k.toFixed(1)} per 1k words
            </p>
            <ul className="mt-4 space-y-1 text-sm">
              {report.byTell
                .filter((t) => t.count > 0)
                .map((t) => (
                  <li key={t.id} className="flex justify-between gap-3 border-b border-border/60 py-1">
                    <span>{t.label}</span>
                    <span className="text-muted">
                      {t.count} · {t.level}
                    </span>
                  </li>
                ))}
            </ul>
            {report.hits.length ? (
              <ul className="mt-4 space-y-3 text-sm">
                {report.hits.slice(0, 20).map((h, i) => (
                  <li key={`${h.pattern}-${i}`} className="rounded-md border border-border bg-bg p-2">
                    <p className="text-xs uppercase tracking-wide text-muted">{h.pattern}</p>
                    <p className="mt-1 italic">&ldquo;{h.quote}&rdquo;</p>
                    {h.suggestion ? <p className="mt-1 text-muted">{h.suggestion}</p> : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ) : null}

        {plans.length ? (
          <section className="mt-6 rounded-md border border-border bg-surface p-4">
            <h2 className="font-serif text-xl">Suggestions</h2>
            <ul className="mt-4 space-y-4">
              {plans.map((plan) => (
                <li key={plan.checkId}>
                  <p className="font-medium">{CHECKS.find((c) => c.id === plan.checkId)?.label}</p>
                  {plan.items.length === 0 ? (
                    <p className="mt-1 text-sm text-muted">No items.</p>
                  ) : (
                    <ul className="mt-2 space-y-2 text-sm">
                      {plan.items.map((item, i) => (
                        <li key={i} className="rounded-md border border-border bg-bg p-2">
                          {item.quote ? <p className="italic">&ldquo;{item.quote}&rdquo;</p> : null}
                          {item.issue ? <p className="mt-1 text-muted">{item.issue}</p> : null}
                          {item.change ? <p className="mt-1">{item.change}</p> : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>
    </div>
  );
}
