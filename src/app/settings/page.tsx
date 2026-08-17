"use client";

import { useEffect, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { QUESTION_BANK } from "@/lib/question-bank";

type Command = {
  id: string;
  slug: string;
  label: string;
  description: string | null;
  defaultTemperature: number;
  promptTemplate: string;
  enableTools: string;
  builtIn: boolean;
};

type TaskRow = {
  id: string;
  label: string;
  description: string;
  defaultModel: string;
  temperature: number;
  group: string;
};

type TaskOverride = { taskId: string; modelId: string; temperature: number | null };

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [commands, setCommands] = useState<Command[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [taskEdits, setTaskEdits] = useState<Record<string, { modelId: string; temperature: string }>>(
    {},
  );
  const [comparePrompt, setComparePrompt] = useState(
    "Write two sentences of grounded bar-room description. No metaphors.",
  );
  const [compareModels, setCompareModels] = useState("anthropic/claude-sonnet-4, openai/gpt-4o-mini");
  const [compareResults, setCompareResults] = useState<Array<{ model: string; text: string }>>([]);
  const [compareBusy, setCompareBusy] = useState(false);
  const [densityJson, setDensityJson] = useState("");
  const [craftPipeline, setCraftPipeline] = useState(true);
  const [editing, setEditing] = useState<Command | null>(null);
  const [status, setStatus] = useState("");

  async function refresh() {
    const res = await fetch("/api/settings");
    const data = await res.json();
    setApiKey(data.settings?.openrouterApiKey ?? "");
    setModel(data.settings?.defaultModel ?? "");
    setCommands(data.commands ?? []);
    setTasks(data.tasks ?? []);
    setDensityJson(data.settings?.densityThresholdsJson ?? "");
    setCraftPipeline(data.settings?.craftPipeline !== false);
    const edits: Record<string, { modelId: string; temperature: string }> = {};
    for (const t of data.tasks ?? []) {
      const ov = (data.taskOverrides ?? []).find((o: TaskOverride) => o.taskId === t.id);
      edits[t.id] = {
        modelId: ov?.modelId ?? t.defaultModel,
        temperature: String(ov?.temperature ?? t.temperature),
      };
    }
    setTaskEdits(edits);
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

  async function saveCommand() {
    if (!editing) return;
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "upsertCommand", payload: editing }),
    });
    setEditing(null);
    await refresh();
  }

  return (
    <div className="min-h-full">
      <AppHeader />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="font-display text-4xl">Settings</h1>
        <p className="mt-2 text-muted">OpenRouter, models, and slash command prompts.</p>

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
            When Expand runs, Quillsmith curates scene lore, sets narrative-physics sliders if the
            scene has none, writes through layered models (brief → dialogue → prose → climax), then
            runs plan-then-apply checks on the new prose. Costs more and takes longer. Coach stays
            for inspection; this is the actual draft.
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
          <h2 className="font-serif text-xl">Per-task models</h2>
          <p className="mt-1 text-sm text-muted">
            Assign different models to Layer brief / dialogue / prose / climax — Expand uses those
            steps. Cheap models for curate, physics, and checks.
          </p>
          <div className="mt-4 overflow-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-muted">
                  <th className="pb-2 pr-2">Task</th>
                  <th className="pb-2 pr-2">Model</th>
                  <th className="pb-2">Temp</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((t) => (
                  <tr key={t.id} className="border-t border-border">
                    <td className="py-2 pr-2 align-top">
                      <p className="font-medium">{t.label}</p>
                      <p className="text-xs text-muted">{t.group}</p>
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        className="w-full rounded border border-border bg-bg px-2 py-1 font-mono text-xs"
                        value={taskEdits[t.id]?.modelId ?? t.defaultModel}
                        onChange={(e) =>
                          setTaskEdits((prev) => ({
                            ...prev,
                            [t.id]: {
                              modelId: e.target.value,
                              temperature: prev[t.id]?.temperature ?? String(t.temperature),
                            },
                          }))
                        }
                      />
                    </td>
                    <td className="py-2">
                      <input
                        className="w-20 rounded border border-border bg-bg px-2 py-1 text-xs"
                        type="number"
                        step="0.05"
                        value={taskEdits[t.id]?.temperature ?? String(t.temperature)}
                        onChange={(e) =>
                          setTaskEdits((prev) => ({
                            ...prev,
                            [t.id]: {
                              modelId: prev[t.id]?.modelId ?? t.defaultModel,
                              temperature: e.target.value,
                            },
                          }))
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            className="mt-3 rounded bg-accent px-3 py-1.5 text-sm text-bg"
            onClick={async () => {
              for (const t of tasks) {
                const edit = taskEdits[t.id];
                if (!edit) continue;
                await fetch("/api/settings", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    action: "upsertTaskOverride",
                    payload: {
                      taskId: t.id,
                      modelId: edit.modelId,
                      temperature: Number(edit.temperature),
                    },
                  }),
                });
              }
              setStatus("Task models saved");
              await refresh();
            }}
          >
            Save task models
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
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-xl">Slash commands</h2>
            <button
              type="button"
              className="text-sm text-accent hover:underline"
              onClick={() =>
                setEditing({
                  id: "",
                  slug: "custom",
                  label: "Custom",
                  description: "",
                  defaultTemperature: 0.7,
                  promptTemplate:
                    "Instruction: {{userInstruction}}\n\nScene:\n{{currentScene}}\n\nCodex:\n{{codex}}",
                  enableTools: "true",
                  builtIn: false,
                })
              }
            >
              Add command
            </button>
          </div>
          <p className="mt-2 text-sm text-muted">
            Built-in Expand/Rewrite templates sync from the app on startup (craft rules live in the
            system prompt). Fork a custom command if you need a permanent personal template.
            Placeholders: {"{{codex}}"}, {"{{taskLead}}"}, {"{{sceneInstructions}}"},{" "}
            {"{{novelMeta}}"}, {"{{outline}}"}, {"{{actTitle}}"}, {"{{chapterTitle}}"},{" "}
            {"{{chapterGoal}}"}, {"{{chapterBeats}}"}, {"{{previousScene}}"}, {"{{currentScene}}"},{" "}
            {"{{nextScene}}"}, {"{{knowledge}}"}, {"{{userInstruction}}"}, {"{{novelPremise}}"},{" "}
            {"{{actBrief}}"}, {"{{chapterText}}"}.
          </p>
          <ul className="mt-4 space-y-2">
            {commands.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between rounded border border-border bg-bg px-3 py-2"
              >
                <div>
                  <p className="font-medium">/{c.slug}</p>
                  <p className="text-xs text-muted">{c.description}</p>
                </div>
                <button
                  type="button"
                  className="text-sm text-accent"
                  onClick={() => setEditing(c)}
                >
                  Edit
                </button>
              </li>
            ))}
          </ul>

          {editing ? (
            <div className="mt-4 space-y-2 rounded border border-border bg-bg p-3">
              <input
                className="w-full rounded border border-border px-2 py-1"
                value={editing.slug}
                onChange={(e) => setEditing({ ...editing, slug: e.target.value })}
                placeholder="slug"
              />
              <input
                className="w-full rounded border border-border px-2 py-1"
                value={editing.label}
                onChange={(e) => setEditing({ ...editing, label: e.target.value })}
                placeholder="label"
              />
              <input
                className="w-full rounded border border-border px-2 py-1"
                type="number"
                step="0.1"
                value={editing.defaultTemperature}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    defaultTemperature: Number(e.target.value),
                  })
                }
              />
              <textarea
                className="w-full rounded border border-border px-2 py-1 font-mono text-xs"
                rows={12}
                value={editing.promptTemplate}
                onChange={(e) =>
                  setEditing({ ...editing, promptTemplate: e.target.value })
                }
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editing.enableTools === "true"}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      enableTools: e.target.checked ? "true" : "false",
                    })
                  }
                />
                Enable tools
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded bg-accent px-3 py-1 text-sm text-bg"
                  onClick={() => void saveCommand()}
                >
                  Save command
                </button>
                <button
                  type="button"
                  className="rounded border border-border px-3 py-1 text-sm"
                  onClick={() => setEditing(null)}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}
        </section>

        <section className="mt-8 rounded border border-border bg-surface p-4">
          <h2 className="font-serif text-xl">Overview question bank</h2>
          <p className="mt-1 text-sm text-muted">Read-only in MVP.</p>
          <ul className="mt-4 max-h-80 space-y-2 overflow-auto text-sm">
            {QUESTION_BANK.map((q) => (
              <li key={q.id} className="rounded border border-border bg-bg px-2 py-2">
                <p className="font-medium">{q.id}</p>
                <p className="text-muted">{q.prompt}</p>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
