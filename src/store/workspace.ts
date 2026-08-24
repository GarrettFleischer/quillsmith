"use client";

import { nanoid } from "nanoid";
import { create } from "zustand";
import type { CodexType } from "@/lib/codex-ui";

type LeftTab = "codex" | "actions";
type MobilePane = "manuscript" | "codex" | "chat" | "plan";

export type CodexTarget =
  | { kind: "story" }
  | { kind: "entry"; entryId: string }
  | { kind: "new"; type: CodexType };

export type ActionTarget = { kind: "action"; slug: string } | { kind: "new-action" };

export type SheetTarget = CodexTarget | ActionTarget;

export type SheetWindow = {
  id: string;
  target: SheetTarget;
  x: number;
  y: number;
  width: number;
  height: number;
  pinned: boolean;
  z: number;
};

export function isActionTarget(target: SheetTarget): target is ActionTarget {
  return target.kind === "action" || target.kind === "new-action";
}

type WorkspaceState = {
  leftTab: LeftTab;
  leftOpen: boolean;
  beatsOpen: boolean;
  summaryOpen: boolean;
  chatOpen: boolean;
  mobilePane: MobilePane;
  selection: string | null;
  actionSlug: string | null;
  extractText: string | null;
  windows: SheetWindow[];
  focusedWindowId: string | null;
  setLeftTab: (tab: LeftTab) => void;
  setLeftOpen: (open: boolean) => void;
  setBeatsOpen: (open: boolean) => void;
  setSummaryOpen: (open: boolean) => void;
  setChatOpen: (open: boolean) => void;
  setMobilePane: (pane: MobilePane) => void;
  sendSelectionToChat: (text: string) => void;
  openExtract: (text: string) => void;
  closeExtract: () => void;
  setActionSlug: (slug: string | null) => void;
  editAction: (slug: string) => void;
  clearSelection: () => void;
  clearAction: () => void;
  openCodexWindow: (target: CodexTarget) => void;
  openActionWindow: (target: ActionTarget) => void;
  closeWindow: (id: string) => void;
  togglePinWindow: (id: string) => void;
  moveWindow: (id: string, x: number, y: number) => void;
  resizeWindow: (id: string, width: number, height: number) => void;
  focusWindow: (id: string) => void;
  retargetWindow: (id: string, target: SheetTarget) => void;
  closeWindowsForEntry: (entryId: string) => void;
  closeWindowsForAction: (slug: string) => void;
  clearCodexWindows: () => void;
};

let zCounter = 1;

function familyOf(target: SheetTarget) {
  return isActionTarget(target) ? "action" : "codex";
}

function targetsEqual(a: SheetTarget, b: SheetTarget) {
  if (a.kind !== b.kind) return false;
  if (a.kind === "story" || a.kind === "new-action") return true;
  if (a.kind === "entry" && b.kind === "entry") return a.entryId === b.entryId;
  if (a.kind === "new" && b.kind === "new") return a.type === b.type;
  if (a.kind === "action" && b.kind === "action") return a.slug === b.slug;
  return false;
}

function bumpZ(windows: SheetWindow[], id: string): SheetWindow[] {
  const nextZ = ++zCounter;
  return windows.map((w) => (w.id === id ? { ...w, z: nextZ } : w));
}

function defaultRect(existingCount: number) {
  const offset = existingCount * 28;
  const header = 56;
  const leftRail = 300;
  return {
    x: Math.min(leftRail + 16 + offset, 640),
    y: header + 16 + offset,
    width: 440,
    height: 560,
  };
}

function topId(windows: SheetWindow[]) {
  return [...windows].sort((a, b) => b.z - a.z)[0]?.id ?? null;
}

function openOrReuse(windows: SheetWindow[], target: SheetTarget) {
  const existing = windows.find((w) => targetsEqual(w.target, target));
  if (existing) {
    return {
      focusedWindowId: existing.id,
      windows: bumpZ(windows, existing.id),
    };
  }
  const reusable = windows.find((w) => !w.pinned && familyOf(w.target) === familyOf(target));
  if (reusable) {
    return {
      focusedWindowId: reusable.id,
      windows: bumpZ(
        windows.map((w) => (w.id === reusable.id ? { ...w, target } : w)),
        reusable.id,
      ),
    };
  }
  const id = nanoid();
  const rect = defaultRect(windows.length);
  const win: SheetWindow = {
    id,
    target,
    ...rect,
    pinned: false,
    z: ++zCounter,
  };
  return {
    windows: [...windows, win],
    focusedWindowId: id,
  };
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  leftTab: "codex",
  leftOpen: true,
  beatsOpen: false,
  summaryOpen: false,
  chatOpen: true,
  mobilePane: "manuscript",
  selection: null,
  actionSlug: null,
  extractText: null,
  windows: [],
  focusedWindowId: null,
  setLeftTab: (leftTab) => set({ leftTab, leftOpen: true }),
  setLeftOpen: (leftOpen) => set({ leftOpen }),
  setBeatsOpen: (beatsOpen) => set({ beatsOpen }),
  setSummaryOpen: (summaryOpen) => set({ summaryOpen }),
  setChatOpen: (chatOpen) => set({ chatOpen }),
  setMobilePane: (mobilePane) => set({ mobilePane }),
  sendSelectionToChat: (text) =>
    set({
      selection: text.trim() || null,
      chatOpen: true,
      mobilePane: "chat",
    }),
  openExtract: (text) => set({ extractText: text.trim() || null }),
  closeExtract: () => set({ extractText: null }),
  setActionSlug: (actionSlug) => set({ actionSlug }),
  editAction: (slug) => {
    get().openActionWindow({ kind: "action", slug });
    set({
      actionSlug: slug,
      leftTab: "actions",
      leftOpen: true,
      mobilePane: "codex",
    });
  },
  clearSelection: () => set({ selection: null }),
  clearAction: () => set({ actionSlug: null }),
  openCodexWindow: (target) => set((s) => openOrReuse(s.windows, target)),
  openActionWindow: (target) => set((s) => openOrReuse(s.windows, target)),
  closeWindow: (id) =>
    set((s) => {
      const next = s.windows.filter((w) => w.id !== id);
      return {
        windows: next,
        focusedWindowId: s.focusedWindowId === id ? topId(next) : s.focusedWindowId,
      };
    }),
  togglePinWindow: (id) =>
    set((s) => ({
      windows: s.windows.map((w) => (w.id === id ? { ...w, pinned: !w.pinned } : w)),
    })),
  moveWindow: (id, x, y) =>
    set((s) => ({
      windows: s.windows.map((w) => (w.id === id ? { ...w, x, y } : w)),
    })),
  resizeWindow: (id, width, height) =>
    set((s) => ({
      windows: s.windows.map((w) => (w.id === id ? { ...w, width, height } : w)),
    })),
  focusWindow: (id) =>
    set((s) => ({
      focusedWindowId: id,
      windows: bumpZ(s.windows, id),
    })),
  retargetWindow: (id, target) =>
    set((s) => ({
      windows: s.windows.map((w) => (w.id === id ? { ...w, target } : w)),
    })),
  closeWindowsForEntry: (entryId) =>
    set((s) => {
      const next = s.windows.filter(
        (w) => !(w.target.kind === "entry" && w.target.entryId === entryId),
      );
      return {
        windows: next,
        focusedWindowId: next.some((w) => w.id === s.focusedWindowId)
          ? s.focusedWindowId
          : topId(next),
      };
    }),
  closeWindowsForAction: (slug) =>
    set((s) => {
      const next = s.windows.filter(
        (w) => !(w.target.kind === "action" && w.target.slug === slug),
      );
      return {
        windows: next,
        focusedWindowId: next.some((w) => w.id === s.focusedWindowId)
          ? s.focusedWindowId
          : topId(next),
      };
    }),
  clearCodexWindows: () =>
    set((s) => {
      const next = s.windows.filter((w) => isActionTarget(w.target));
      return {
        windows: next,
        focusedWindowId: next.some((w) => w.id === s.focusedWindowId)
          ? s.focusedWindowId
          : topId(next),
      };
    }),
}));
