"use client";

import { useEffect, useState } from "react";
import { AppHeader } from "@/components/app-header";

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [comparePrompt, setComparePrompt] = useState(
    "Write two sentences of grounded bar-room description. No metaphors.",
  );
  const [compareModels, setCompareModels] = useState("anthropic/claude-sonnet-4, openai/gpt-4o-mini");
  const [compareResults, setCompareResults] = useState<Array<{ model: string; text: string }>>([]);
  const [compareBusy, setCompareBusy] = useState(false);
  const [densityJson, setDensityJson] = useState("");
  const [craftPipeline, setCraftPipeline] = useState(true);
  const [status, setStatus] = useState("");

  async function refresh() {
    const res = await fetch("/api/settings");
    const data = await res.json();
    setApiKey(data.settings?.openrouterApiKey ?? "");
    setModel(data.settings?.defaultModel ?? "");
    setDensityJson(data.settings?.densityThresholdsJson ?? "");
    setCraftPipeline(data.settings?.craftPipeline !== false);
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function saveSettings() {
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "updateSettings",
        payload: { openrouterApiKey: apiKey, defaultModel: model },
      }),
    });
    setStatus("Settings saved");
  }

  return (
    <div className="min-h-full">
      <AppHeader />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="font-display text-4xl">Settings</h1>
        <p className="mt-2 text-muted">
          OpenRouter, models, and drafting pipeline. Chapter Actions live in Write → Actions.
        </p>

        <section className="mt-8 space-y-3 rounded border border-border bg-surface p-4">
          <h2 className="font-serif text-xl">OpenRouter</h2>
          <label className="block text-sm">
            API key
            <input
              type="password"
              className="mt-1 w-full rounded border border-border bg-bg px-3 py-2"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            Default model
            <input
              className="mt-1 w-full rounded border border-border bg-bg px-3 py-2"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="anthropic/claude-sonnet-4"
            />
          </label>
          <button
            type="button"
            className="rounded bg-accent px-3 py-2 text-sm text-bg"
            onClick={() => void saveSettings()}
          >
            Save
          </button>
          {status ? <p className="text-sm text-accent">{status}</p> : null}
        </section>

        <section className="mt-8 rounded border border-border bg-surface p-4">
          <h2 className="font-serif text-xl">Drafting pipeline</h2>
          <p className="mt-1 text-sm text-muted">
            When Expand runs, Quillsmith curates chapter lore, sets narrative-physics sliders if
            needed, writes through layered models (brief → dialogue → prose → climax), then runs
            plan-then-apply checks on the new prose. Costs more and takes longer. Review is for
            inspection; this is the actual draft.
          </p>
          <label className="mt-3 flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={craftPipeline}
              onChange={(e) => setCraftPipeline(e.target.checked)}
            />
            <span>Use the craft pipeline on Expand and Rewrite (Rewrite gets the check pass only)</span>
          </label>
          <button
            type="button"
            className="mt-3 rounded bg-accent px-3 py-1.5 text-sm text-bg"
            onClick={async () => {
              await fetch("/api/settings", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  action: "updateSettings",
                  payload: { craftPipeline },
                }),
              });
              setStatus("Drafting pipeline saved");
            }}
          >
            Save pipeline
          </button>
        </section>

        <section className="mt-8 rounded border border-border bg-surface p-4">
          <h2 className="font-serif text-xl">Compare models</h2>
          <p className="mt-1 text-sm text-muted">
            Same small task, two or three models. Ask which output feels closest to how you would
            have done it.
          </p>
          <textarea
            className="mt-3 w-full rounded border border-border bg-bg px-2 py-2 text-sm"
            rows={4}
            value={comparePrompt}
            onChange={(e) => setComparePrompt(e.target.value)}
          />
          <input
            className="mt-2 w-full rounded border border-border bg-bg px-2 py-1 font-mono text-xs"
            value={compareModels}
            onChange={(e) => setCompareModels(e.target.value)}
            placeholder="model-a, model-b"
          />
          <button
            type="button"
            disabled={compareBusy}
            className="mt-2 rounded bg-accent px-3 py-1.5 text-sm text-bg disabled:opacity-50"
            onClick={async () => {
              setCompareBusy(true);
              setCompareResults([]);
              try {
                const res = await fetch("/api/ai/compare", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    novelId: "settings",
                    prompt: comparePrompt,
                    models: compareModels.split(",").map((s) => s.trim()).filter(Boolean),
                  }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || "Compare failed");
                setCompareResults(data.results ?? []);
              } catch (e) {
                setStatus(e instanceof Error ? e.message : "Compare failed");
              } finally {
                setCompareBusy(false);
              }
            }}
          >
            {compareBusy ? "Comparing…" : "Compare"}
          </button>
          {compareResults.length ? (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {compareResults.map((r) => (
                <div key={r.model} className="rounded border border-border bg-bg p-3">
                  <p className="font-mono text-xs text-muted">{r.model}</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm">{r.text}</p>
                </div>
              ))}
            </div>
          ) : null}
        </section>

        <section className="mt-8 rounded border border-border bg-surface p-4">
          <h2 className="font-serif text-xl">Density thresholds</h2>
          <p className="mt-1 text-sm text-muted">
            JSON overrides for elevated/high pattern counts. Leave blank for defaults (15 / 25 per
            1k words).
          </p>
          <textarea
            className="mt-2 w-full rounded border border-border bg-bg px-2 py-2 font-mono text-xs"
            rows={4}
            placeholder='{"elevatedTotalPer1k":15,"highTotalPer1k":25,"elevatedSingle":4,"highMetaphor":6,"highListRhythm":4}'
            value={densityJson}
            onChange={(e) => setDensityJson(e.target.value)}
          />
          <button
            type="button"
            className="mt-2 rounded border border-border px-3 py-1.5 text-sm"
            onClick={async () => {
              await fetch("/api/settings", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  action: "updateSettings",
                  payload: { densityThresholdsJson: densityJson },
                }),
              });
              setStatus("Density thresholds saved");
            }}
          >
            Save thresholds
          </button>
        </section>

        <section className="mt-8 rounded border border-border bg-surface p-4">
          <h2 className="font-serif text-xl">Actions</h2>
          <p className="mt-2 text-sm text-muted">
            Saved prompt Actions (Expand, Rewrite, custom templates) are edited in the Write
            workspace under the left Actions tab, next to Codex. Each Action can pick its own model
            or leave it blank to inherit the default model above.
          </p>
        </section>
      </main>
    </div>
  );
}
