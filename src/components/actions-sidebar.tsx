"use client";

import { useMemo, useState } from "react";
import { IconPlus, IconSearch, IconSpark } from "@/components/codex-icons";
import { LeftRailTabs } from "@/components/left-rail-tabs";
import { entrySnippet } from "@/lib/codex-ui";
import type { SavedAction } from "@/lib/saved-action";
import { useWorkspaceStore } from "@/store/workspace";

export function ActionsSidebar({
  actions,
  onCollapse,
  className,
}: {
  actions: SavedAction[];
  onCollapse?: () => void;
  className?: string;
}) {
  const [filter, setFilter] = useState("");
  const openActionWindow = useWorkspaceStore((s) => s.openActionWindow);
  const windows = useWorkspaceStore((s) => s.windows);
  const focusedId = useWorkspaceStore((s) => s.focusedWindowId);
  const activeTarget = windows.find((w) => w.id === focusedId)?.target ?? null;
  const q = filter.trim().toLowerCase();

  const filtered = useMemo(
    () =>
      actions.filter(
        (a) =>
          !q ||
          a.label.toLowerCase().includes(q) ||
          a.slug.toLowerCase().includes(q) ||
          (a.description ?? "").toLowerCase().includes(q),
      ),
    [actions, q],
  );

  function isActive(slug: string) {
    return activeTarget?.kind === "action" && activeTarget.slug === slug;
  }

  return (
    <aside
      className={`flex h-full min-h-0 w-[300px] shrink-0 flex-col border-r border-border bg-surface/70 panel-enter ${className ?? ""}`}
    >
      <LeftRailTabs onCollapse={onCollapse} />
      <div className="border-b border-border px-3 py-2">
        <div className="flex items-center gap-1.5">
          <div className="relative min-w-0 flex-1">
            <IconSearch className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
            <input
              className="w-full rounded-md border border-border bg-bg py-1.5 pr-2 pl-7 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              placeholder="Search actions…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="flex shrink-0 items-center gap-1 rounded-md border border-border bg-bg px-2 py-1.5 text-xs hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            onClick={() => openActionWindow({ kind: "new-action" })}
          >
            <IconPlus className="h-3.5 w-3.5" />
            New Action
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-2 py-2">
        {filtered.length === 0 ? (
          <p className="px-2 py-2 text-sm text-muted">
            {q ? "No matching actions." : "No actions yet."}
          </p>
        ) : (
          filtered.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => openActionWindow({ kind: "action", slug: a.slug })}
              className={`mb-0.5 flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset ${
                isActive(a.slug) ? "bg-accent-soft ring-1 ring-accent/40" : "hover:bg-surface-2"
              }`}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-bg text-muted">
                <IconSpark className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className={`truncate text-sm ${isActive(a.slug) ? "text-accent" : ""}`}>
                    {a.label}
                  </span>
                  {a.builtIn ? (
                    <span className="shrink-0 rounded border border-border px-1 py-px text-[10px] text-muted">
                      Built-in
                    </span>
                  ) : null}
                </span>
                <span className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted">
                  {entrySnippet(a.description, a.slug)}
                </span>
              </span>
            </button>
          ))
        )}
      </div>
    </aside>
  );
}
