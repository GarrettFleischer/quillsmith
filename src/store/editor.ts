"use client";

import { create } from "zustand";

type EditorState = {
  novelId: string | null;
  activeChapterId: string | null;
  activeSceneId: string | null;
  activeActId: string | null;
  status: string;
  setNovel: (novelId: string) => void;
  setActive: (p: {
    chapterId?: string | null;
    sceneId?: string | null;
    actId?: string | null;
  }) => void;
  setStatus: (s: string) => void;
};

export const useEditorStore = create<EditorState>((set) => ({
  novelId: null,
  activeChapterId: null,
  activeSceneId: null,
  activeActId: null,
  status: "",
  setNovel: (novelId) =>
    set((s) =>
      s.novelId === novelId
        ? s
        : {
            novelId,
            activeChapterId: null,
            activeSceneId: null,
            activeActId: null,
          },
    ),
  setActive: (p) =>
    set((s) => ({
      activeChapterId: p.chapterId === undefined ? s.activeChapterId : p.chapterId,
      activeSceneId: p.sceneId === undefined ? s.activeSceneId : p.sceneId,
      activeActId: p.actId === undefined ? s.activeActId : p.actId,
    })),
  setStatus: (status) => set({ status }),
}));
