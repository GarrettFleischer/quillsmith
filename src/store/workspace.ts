"use client";

import { create } from "zustand";

type LeftTab = "codex" | "settings";
type MobilePane = "manuscript" | "codex" | "chat" | "plan";

type WorkspaceState = {
  leftTab: LeftTab;
  leftOpen: boolean;
  beatsOpen: boolean;
  summaryOpen: boolean;
  chatOpen: boolean;
  mobilePane: MobilePane;
  selection: string | null;
  actionSlug: string | null;
  focusedActionSlug: string | null;
  setLeftTab: (tab: LeftTab) => void;
  setLeftOpen: (open: boolean) => void;
  setBeatsOpen: (open: boolean) => void;
  setSummaryOpen: (open: boolean) => void;
  setChatOpen: (open: boolean) => void;
  setMobilePane: (pane: MobilePane) => void;
  sendSelectionToChat: (text: string) => void;
  setActionSlug: (slug: string | null) => void;
  openActionInSettings: (slug: string) => void;
  clearSelection: () => void;
  clearAction: () => void;
};

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  leftTab: "codex",
  leftOpen: true,
  beatsOpen: false,
  summaryOpen: false,
  chatOpen: true,
  mobilePane: "manuscript",
  selection: null,
  actionSlug: null,
  focusedActionSlug: null,
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
  setActionSlug: (actionSlug) => set({ actionSlug }),
  openActionInSettings: (slug) =>
    set({
      actionSlug: slug,
      focusedActionSlug: slug,
      leftTab: "settings",
      leftOpen: true,
      mobilePane: "codex",
    }),
  clearSelection: () => set({ selection: null }),
  clearAction: () => set({ actionSlug: null }),
}));
