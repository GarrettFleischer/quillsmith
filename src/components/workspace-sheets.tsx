"use client";

import { ActionEditor } from "@/components/action-editor";
import { CodexEntryEditor } from "@/components/codex-entry-editor";
import { FloatingPane } from "@/components/floating-pane";
import type { KnowledgeEntry, StoryFields } from "@/components/knowledge-sidebar";
import type { SavedAction } from "@/lib/saved-action";
import { isActionTarget, useWorkspaceStore, type SheetTarget } from "@/store/workspace";

function sheetTitle(
  target: SheetTarget,
  story: StoryFields,
  entries: KnowledgeEntry[],
  actions: SavedAction[],
) {
  if (isActionTarget(target)) {
    if (target.kind === "new-action") return "New action";
    return actions.find((a) => a.slug === target.slug)?.label ?? "Action";
  }
  if (target.kind === "story") return story.title || "Story";
  if (target.kind === "new") return "New entry";
  return entries.find((e) => e.id === target.entryId)?.name ?? "Entry";
}

export function WorkspaceSheets({
  novelId,
  entries,
  story,
  actions,
  onCodexChange,
  onActionsChange,
  onJumpToProse,
}: {
  novelId: string;
  entries: KnowledgeEntry[];
  story: StoryFields;
  actions: SavedAction[];
  onCodexChange: () => void;
  onActionsChange: () => void;
  onJumpToProse: (sceneId: string) => void;
}) {
  const windows = useWorkspaceStore((s) => s.windows);
  const focusedId = useWorkspaceStore((s) => s.focusedWindowId);
  const closeWindow = useWorkspaceStore((s) => s.closeWindow);
  const togglePinWindow = useWorkspaceStore((s) => s.togglePinWindow);
  const moveWindow = useWorkspaceStore((s) => s.moveWindow);
  const resizeWindow = useWorkspaceStore((s) => s.resizeWindow);
  const focusWindow = useWorkspaceStore((s) => s.focusWindow);
  const retargetWindow = useWorkspaceStore((s) => s.retargetWindow);
  const closeWindowsForEntry = useWorkspaceStore((s) => s.closeWindowsForEntry);
  const closeWindowsForAction = useWorkspaceStore((s) => s.closeWindowsForAction);

  return (
    <>
      {windows.map((win) => (
        <FloatingPane
          key={win.id}
          title={sheetTitle(win.target, story, entries, actions)}
          pinned={win.pinned}
          focused={focusedId === win.id}
          x={win.x}
          y={win.y}
          width={win.width}
          height={win.height}
          z={win.z}
          onClose={() => closeWindow(win.id)}
          onPin={() => togglePinWindow(win.id)}
          onMove={(x, y) => moveWindow(win.id, x, y)}
          onResize={(w, h) => resizeWindow(win.id, w, h)}
          onFocus={() => focusWindow(win.id)}
        >
          {isActionTarget(win.target) ? (
            <ActionEditor
              windowId={win.id}
              target={win.target}
              actions={actions}
              onChange={onActionsChange}
              onCreated={(id, slug) => retargetWindow(id, { kind: "action", slug })}
              onDeleted={closeWindowsForAction}
            />
          ) : (
            <CodexEntryEditor
              windowId={win.id}
              target={win.target}
              novelId={novelId}
              entries={entries}
              story={story}
              onChange={onCodexChange}
              onJumpToProse={onJumpToProse}
              onCreated={(id, entryId) => retargetWindow(id, { kind: "entry", entryId })}
              onDeleted={closeWindowsForEntry}
            />
          )}
        </FloatingPane>
      ))}
    </>
  );
}
