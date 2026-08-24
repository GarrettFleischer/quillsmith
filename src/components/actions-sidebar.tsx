"use client";

import { useMemo, useState } from "react";
import { IconPlus, IconSearch, IconSpark } from "@/components/codex-icons";
import { LeftRailTabs } from "@/components/left-rail-tabs";
import { entrySnippet } from "@/lib/codex-ui";
import type { SavedAction } from "@/lib/saved-action";
import { useWorkspaceStore } from "@/store/workspace";

export function ActionsSidebar({
  actions,
  onChange,
  onCollapse,
  className,
}: {
  actions: SavedAction[];
  onChange?: () => void;
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

  async function toggleFavorite(a: SavedAction) {
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "setCommandFavorite",
        payload: { id: a.id, favorite: !a.favorite },
      }),
    });
    onChange?.();
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
            <div
              key={a.id}
              className={`group mb-0.5 flex items-start gap-1 rounded-md ${
                isActive(a.slug) ? "bg-accent-soft ring-1 ring-accent/40" : "hover:bg-surface-2"
              }`}
            >
              <button
                type="button"
                onClick={() => openActionWindow({ kind: "action", slug: a.slug })}
                className="flex min-w-0 flex-1 cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
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
                      <span className="shrink-0 rounded border border-border px-1 py-px text-xs text-muted">
                        Built-in
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted">
                    {entrySnippet(a.description, a.slug)}
                  </span>
                </span>
              </button>
              <button
                type="button"
                aria-label={a.favorite ? `Unfavorite ${a.label}` : `Favorite ${a.label}`}
                aria-pressed={a.favorite}
                title={
                  a.favorite
                    ? "Favorited — shown as a quick action in Chat"
                    : "Favorite — pin as a quick action in Chat"
                }
                onClick={() => void toggleFavorite(a)}
                className={`mt-1 mr-1 shrink-0 cursor-pointer rounded p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                  a.favorite ? "text-accent" : "text-muted/40 hover:text-accent"
                }`}
              >
                <StarIcon className="h-4 w-4" filled={a.favorite} />
              </button>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}

function StarIcon({ className, filled }: { className?: string; filled?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3.5l2.6 5.27 5.82.85-4.21 4.1.99 5.79L12 16.98l-5.2 2.53.99-5.79-4.21-4.1 5.82-.85L12 3.5z" />
    </svg>
  );
}
