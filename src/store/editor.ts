"use client";

import { create } from "zustand";

type EditorState = {
  activeChapterId: string | null;
  activeSceneId: string | null;
  activeActId: string | null;
  status: string;
  setActive: (p: {
    chapterId?: string | null;
    sceneId?: string | null;
    actId?: string | null;
  }) => void;
  setStatus: (s: string) => void;
};

export const useEditorStore = create<EditorState>((set) => ({
  activeChapterId: null,
  activeSceneId: null,
  activeActId: null,
  status: "",
  setActive: (p) =>
    set((s) => ({
      activeChapterId: p.chapterId === undefined ? s.activeChapterId : p.chapterId,
      activeSceneId: p.sceneId === undefined ? s.activeSceneId : p.sceneId,
      activeActId: p.actId === undefined ? s.activeActId : p.actId,
    })),
  setStatus: (status) => set({ status }),
}));
