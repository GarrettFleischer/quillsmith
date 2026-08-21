"use client";

import { IconBook, IconSpark } from "@/components/codex-icons";
import { useWorkspaceStore } from "@/store/workspace";

export function LeftRailTabs({ onCollapse }: { onCollapse?: () => void }) {
  const leftTab = useWorkspaceStore((s) => s.leftTab);
  const setLeftTab = useWorkspaceStore((s) => s.setLeftTab);

  return (
    <div className="flex items-center gap-1 border-b border-border px-2 pt-2">
      <div className="flex min-w-0 flex-1 gap-0.5" role="tablist" aria-label="Left rail">
        <button
          type="button"
          role="tab"
          aria-selected={leftTab === "codex"}
          className={`-mb-px flex items-center gap-1.5 rounded-t px-2.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
            leftTab === "codex"
              ? "border-b-2 border-accent text-text"
              : "border-b-2 border-transparent text-muted hover:text-text"
          }`}
          onClick={() => setLeftTab("codex")}
        >
          <IconBook className="h-3.5 w-3.5" />
          Codex
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={leftTab === "actions"}
          className={`-mb-px flex items-center gap-1.5 rounded-t px-2.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
            leftTab === "actions"
              ? "border-b-2 border-accent text-text"
              : "border-b-2 border-transparent text-muted hover:text-text"
          }`}
          onClick={() => setLeftTab("actions")}
        >
          <IconSpark className="h-3.5 w-3.5" />
          Actions
        </button>
      </div>
      {onCollapse ? (
        <button
          type="button"
          className="mb-1 rounded px-1.5 py-1 text-xs text-muted hover:bg-surface-2 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          onClick={onCollapse}
        >
          Hide
        </button>
      ) : null}
    </div>
  );
}
