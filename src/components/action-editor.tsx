"use client";

import { useEffect, useState, type KeyboardEvent } from "react";
import { IconSpark } from "@/components/codex-icons";
import { PROSE_TEMPLATE_PLACEHOLDERS } from "@/lib/prompts/templates";
import {
  NEW_ACTION_DRAFT,
  PRIMARY_ACTION_VARS,
  type SavedAction,
} from "@/lib/saved-action";
import type { ActionTarget } from "@/store/workspace";

export function ActionEditor({
  windowId,
  target,
  actions,
  onChange,
  onCreated,
  onDeleted,
}: {
  windowId: string;
  target: ActionTarget;
  actions: SavedAction[];
  onChange: () => void;
  onCreated: (windowId: string, slug: string) => void;
  onDeleted: (slug: string) => void;
}) {
  const existing = target.kind === "action" ? (actions.find((a) => a.slug === target.slug) ?? null) : null;
  const [draft, setDraft] = useState<SavedAction>(NEW_ACTION_DRAFT);
  const [status, setStatus] = useState("");
  const targetKey = target.kind === "new-action" ? "new-action" : target.slug;

  useEffect(() => {
    setStatus("");
    if (target.kind === "new-action") {
      setDraft(NEW_ACTION_DRAFT);
      return;
    }
    if (existing) setDraft(existing);
    // Sync when the opened action changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey]);

  function insertVar(name: string) {
    setDraft((d) => ({ ...d, promptTemplate: `${d.promptTemplate}{{${name}}}` }));
  }

  async function save() {
    if (!draft.label.trim() || !draft.slug.trim()) return;
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "upsertCommand",
        payload: {
          id: existing?.id || undefined,
          slug: draft.slug.trim(),
          label: draft.label.trim(),
          description: draft.description,
          defaultTemperature: draft.defaultTemperature,
          promptTemplate: draft.promptTemplate,
          enableTools: draft.enableTools,
          model: (draft.model ?? "").trim(),
        },
      }),
    });
    if (!res.ok) {
      setStatus("Could not save");
      return;
    }
    const saved = (await res.json()) as SavedAction;
    setStatus("Saved");
    setDraft(saved);
    if (target.kind === "new-action" && saved.slug) onCreated(windowId, saved.slug);
    else if (existing && saved.slug && saved.slug !== existing.slug) onCreated(windowId, saved.slug);
    onChange();
  }

  async function remove() {
    if (!existing || existing.builtIn) return;
    if (!confirm(`Delete action “${existing.label}”?`)) return;
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "deleteCommand", payload: { id: existing.id } }),
    });
    if (!res.ok) {
      setStatus("Could not delete");
      return;
    }
    onDeleted(existing.slug);
    onChange();
  }

  function onKeyDown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === "s") {
      e.preventDefault();
      void save();
    }
  }

  const extraVars = PROSE_TEMPLATE_PLACEHOLDERS.filter(
    (n) => !(PRIMARY_ACTION_VARS as readonly string[]).includes(n),
  ).slice(0, 8);

  return (
    <div className="flex h-full min-h-0 flex-col" onKeyDown={onKeyDown}>
      <div className="shrink-0 border-b border-border px-4 pt-3 pb-3">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted">{existing?.builtIn ? "Built-in action" : "Action"}</p>
            <input
              className="mt-0.5 w-full bg-transparent font-serif text-2xl leading-tight placeholder:text-muted focus-visible:outline-none"
              value={draft.label}
              onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
              placeholder="Name"
            />
          </div>
          <div className="flex h-14 w-14 items-center justify-center rounded-md border border-border bg-bg text-muted">
            <IconSpark className="h-8 w-8" />
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-4 py-3 text-sm">
        <label className="mb-3 block text-xs text-muted">
          Slug
          <input
            className="mt-1 w-full rounded-md border border-border bg-bg px-2 py-1.5 font-mono text-xs text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            value={draft.slug}
            onChange={(e) => setDraft((d) => ({ ...d, slug: e.target.value }))}
            placeholder="expand"
          />
        </label>
        <label className="mb-3 block text-xs text-muted">
          Description
          <input
            className="mt-1 w-full rounded-md border border-border bg-bg px-2 py-1.5 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            value={draft.description ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
            placeholder="When to use this action"
          />
        </label>
        <label className="mb-3 block text-xs text-muted">
          Model
          <input
            className="mt-1 w-full rounded-md border border-border bg-bg px-2 py-1.5 font-mono text-xs text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            value={draft.model ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, model: e.target.value }))}
            placeholder="inherit — global default model"
          />
          <span className="mt-1 block font-sans text-xs text-muted">
            Leave blank to inherit the global default model from Settings.
          </span>
        </label>
        <label className="mb-3 block text-xs text-muted">
          Temperature
          <input
            type="number"
            min={0}
            max={2}
            step={0.1}
            className="mt-1 w-full rounded-md border border-border bg-bg px-2 py-1.5 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            value={draft.defaultTemperature}
            onChange={(e) =>
              setDraft((d) => ({ ...d, defaultTemperature: Number(e.target.value) }))
            }
          />
        </label>
        <p className="mb-1 text-xs text-muted">Variables</p>
        <div className="mb-3 flex flex-wrap gap-1">
          {[...PRIMARY_ACTION_VARS, ...extraVars].map((name) => (
            <button
              key={name}
              type="button"
              className="rounded border border-border px-1.5 py-0.5 font-mono text-xs text-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              onClick={() => insertVar(name)}
            >
              {`{{${name}}}`}
            </button>
          ))}
        </div>
        <label className="mb-1 block text-xs text-muted">Prompt</label>
        <textarea
          className="mb-3 w-full rounded-md border border-border bg-bg px-2 py-1.5 font-mono text-xs text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          rows={12}
          value={draft.promptTemplate}
          onChange={(e) => setDraft((d) => ({ ...d, promptTemplate: e.target.value }))}
        />
        <label className="mb-3 flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={draft.enableTools === "true"}
            onChange={(e) =>
              setDraft((d) => ({ ...d, enableTools: e.target.checked ? "true" : "false" }))
            }
          />
          Enable Codex tools
        </label>
        {existing?.builtIn ? (
          <p className="text-xs text-muted">
            Saving keeps your copy. Later app updates will not overwrite this prompt.
          </p>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-2 border-t border-border px-4 py-2">
        <button
          type="button"
          className="rounded-md bg-accent px-3 py-1.5 text-xs text-bg disabled:opacity-50"
          onClick={() => void save()}
          disabled={!draft.label.trim() || !draft.slug.trim()}
        >
          Save
        </button>
        {existing && !existing.builtIn ? (
          <button
            type="button"
            className="ml-auto text-xs text-danger hover:underline"
            onClick={() => void remove()}
          >
            Delete
          </button>
        ) : null}
        {status ? (
          <p className={`text-xs text-accent ${existing && !existing.builtIn ? "" : "ml-auto"}`}>
            {status}
          </p>
        ) : null}
      </div>
    </div>
  );
}
