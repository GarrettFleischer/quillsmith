"use client";

import { useEffect, useState } from "react";
import { PROSE_TEMPLATE_PLACEHOLDERS } from "@/lib/prompts/templates";
import { useWorkspaceStore } from "@/store/workspace";

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

export function ActionsSidebar({
  onCollapse,
  onChange,
  className,
}: {
  onCollapse?: () => void;
  onChange?: () => void;
  className?: string;
}) {
  const focusedActionSlug = useWorkspaceStore((s) => s.focusedActionSlug);
  const [commands, setCommands] = useState<Command[]>([]);
  const [editing, setEditing] = useState<Command | null>(null);
  const [status, setStatus] = useState("");

  async function refresh() {
    const res = await fetch("/api/settings");
    const data = await res.json();
    const list = (data.commands ?? []) as Command[];
    setCommands(list);
    if (focusedActionSlug) {
      const match = list.find((c) => c.slug === focusedActionSlug);
      if (match) setEditing(match);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!focusedActionSlug) return;
    const match = commands.find((c) => c.slug === focusedActionSlug);
    if (match) setEditing(match);
  }, [focusedActionSlug, commands]);

  async function saveCommand() {
    if (!editing) return;
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "upsertCommand", payload: editing }),
    });
    setStatus("Saved");
    await refresh();
    onChange?.();
  }

  function insertVar(name: string) {
    if (!editing) return;
    setEditing({
      ...editing,
      promptTemplate: `${editing.promptTemplate}{{${name}}}`,
    });
  }

  return (
    <aside
      className={`flex h-full min-h-0 w-[280px] shrink-0 flex-col border-r border-border bg-surface/70 panel-enter ${className ?? ""}`}
    >
      <div className="border-b border-border px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-serif text-lg">Settings</h2>
          {onCollapse ? (
            <button
              type="button"
              className="text-xs text-muted hover:text-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              onClick={onCollapse}
            >
              Hide
            </button>
          ) : null}
        </div>
        <p className="mt-1 text-xs text-muted">
          Saved Actions with injectable variables. API key lives under App.
        </p>
      </div>
      <ul className="min-h-0 flex-1 space-y-1 overflow-auto p-2">
        {commands.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              className={`w-full rounded px-2 py-2 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset ${
                editing?.id === c.id ? "bg-accent-soft text-accent" : "hover:bg-surface-2"
              }`}
              onClick={() => setEditing(c)}
            >
              <span className="block font-medium">{c.label}</span>
              <span className="text-xs text-muted">{c.slug}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="border-t border-border p-2">
        <button
          type="button"
          className="text-xs text-accent hover:underline"
          onClick={() =>
            setEditing({
              id: "",
              slug: "custom",
              label: "Custom",
              description: "",
              defaultTemperature: 0.7,
              promptTemplate:
                "Instruction: {{userInstruction}}\n\nSelection:\n{{selection}}\n\nChapter:\n{{currentChapter}}\n\nMentioned Codex:\n{{mentionedCodex}}",
              enableTools: "true",
              builtIn: false,
            })
          }
        >
          New action
        </button>
      </div>
      {editing ? (
        <div className="max-h-[50%] overflow-auto border-t border-border p-3 text-sm">
          <input
            className="mb-2 w-full rounded border border-border bg-bg px-2 py-1"
            value={editing.label}
            onChange={(e) => setEditing({ ...editing, label: e.target.value })}
            placeholder="Label"
          />
          <input
            className="mb-2 w-full rounded border border-border bg-bg px-2 py-1 font-mono text-xs"
            value={editing.slug}
            onChange={(e) => setEditing({ ...editing, slug: e.target.value })}
            placeholder="slug"
          />
          <p className="mb-1 text-xs text-muted">Variables</p>
          <div className="mb-2 flex flex-wrap gap-1">
            {["mentionedCodex", "selection", "chapterSummary", "chapterBeats", "currentChapter", "userInstruction", "codex"].map(
              (name) => (
                <button
                  key={name}
                  type="button"
                  className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted hover:text-text"
                  onClick={() => insertVar(name)}
                >
                  {`{{${name}}}`}
                </button>
              ),
            )}
            {PROSE_TEMPLATE_PLACEHOLDERS.filter(
              (n) =>
                ![
                  "mentionedCodex",
                  "selection",
                  "chapterSummary",
                  "chapterBeats",
                  "currentChapter",
                  "userInstruction",
                  "codex",
                ].includes(n),
            )
              .slice(0, 8)
              .map((name) => (
                <button
                  key={name}
                  type="button"
                  className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted hover:text-text"
                  onClick={() => insertVar(name)}
                >
                  {`{{${name}}}`}
                </button>
              ))}
          </div>
          <textarea
            className="mb-2 w-full rounded border border-border bg-bg px-2 py-1 font-mono text-xs"
            rows={10}
            value={editing.promptTemplate}
            onChange={(e) => setEditing({ ...editing, promptTemplate: e.target.value })}
          />
          <label className="mb-2 flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={editing.enableTools === "true"}
              onChange={(e) =>
                setEditing({ ...editing, enableTools: e.target.checked ? "true" : "false" })
              }
            />
            Enable Codex tools
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded bg-accent px-2 py-1 text-xs text-bg"
              onClick={() => void saveCommand()}
            >
              Save
            </button>
            <button
              type="button"
              className="rounded border border-border px-2 py-1 text-xs"
              onClick={() => setEditing(null)}
            >
              Close
            </button>
          </div>
          {status ? <p className="mt-2 text-xs text-accent">{status}</p> : null}
        </div>
      ) : null}
    </aside>
  );
}
