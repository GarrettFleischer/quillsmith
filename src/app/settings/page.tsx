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

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [commands, setCommands] = useState<Command[]>([]);
  const [editing, setEditing] = useState<Command | null>(null);
  const [status, setStatus] = useState("");

  async function refresh() {
    const res = await fetch("/api/settings");
    const data = await res.json();
    setApiKey(data.settings?.openrouterApiKey ?? "");
    setModel(data.settings?.defaultModel ?? "");
    setCommands(data.commands ?? []);
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
                  promptTemplate: "Instruction: {{userInstruction}}\n\nScene:\n{{currentScene}}",
                  enableTools: "true",
                  builtIn: false,
                })
              }
            >
              Add command
            </button>
          </div>
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
