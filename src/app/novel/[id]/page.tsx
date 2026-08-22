"use client";

import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ActionsSidebar } from "@/components/actions-sidebar";
import { AppHeader } from "@/components/app-header";
import { BeatsSidebar, type Beat } from "@/components/beats-sidebar";
import { ChapterChat } from "@/components/chapter-chat";
import { ChapterEditor, type DraftResult } from "@/components/chapter-editor";
import { ChapterSummaryRail } from "@/components/chapter-summary";
import { KnowledgeSidebar, type KnowledgeEntry, type StoryFields } from "@/components/knowledge-sidebar";
import { ManuscriptMenu } from "@/components/manuscript-menu";
import { RailStrip } from "@/components/rail-strip";
import { WorkspaceSheets } from "@/components/workspace-sheets";
import { useEditorStore } from "@/store/editor";
import { useWorkspaceStore } from "@/store/workspace";
import { actLabel, actName, chapterLabel, chapterName } from "@/lib/manuscript";
import type { SavedAction } from "@/lib/saved-action";

type Prose = {
  id: string;
  title: string | null;
  content: string;
  chapterId: string;
  slidersJson?: string | null;
};

type Tree = {
  novel: StoryFields & { id: string };
  acts: Array<{
    id: string;
    title: string;
    brief: string | null;
    summary?: string | null;
    chapters: Array<{
      id: string;
      title: string;
      goal: string | null;
      summary: string | null;
      beats: Beat[];
      prose: Prose | null;
      scenes: Prose[];
    }>;
  }>;
  knowledge: KnowledgeEntry[];
};

type MobilePane = "manuscript" | "codex" | "chat" | "plan";

const MOBILE_TABS: { id: MobilePane; label: string }[] = [
  { id: "manuscript", label: "Manuscript" },
  { id: "codex", label: "Codex" },
  { id: "chat", label: "Chat" },
  { id: "plan", label: "Plan" },
];

export default function WritePage() {
  const params = useParams<{ id: string }>();
  const novelId = params.id;
  const [data, setData] = useState<Tree | null>(null);
  const [loadError, setLoadError] = useState("");
  const [commands, setCommands] = useState<SavedAction[]>([]);
  const [model, setModel] = useState("anthropic/claude-sonnet-4");
  const [hasApiKey, setHasApiKey] = useState(true);
  const [draftResult, setDraftResult] = useState<DraftResult | null>(null);
  const activeChapterId = useEditorStore((s) => s.activeChapterId);
  const setActive = useEditorStore((s) => s.setActive);
  const setNovel = useEditorStore((s) => s.setNovel);
  const status = useEditorStore((s) => s.status);
  const leftTab = useWorkspaceStore((s) => s.leftTab);
  const leftOpen = useWorkspaceStore((s) => s.leftOpen);
  const setLeftOpen = useWorkspaceStore((s) => s.setLeftOpen);
  const beatsOpen = useWorkspaceStore((s) => s.beatsOpen);
  const setBeatsOpen = useWorkspaceStore((s) => s.setBeatsOpen);
  const summaryOpen = useWorkspaceStore((s) => s.summaryOpen);
  const setSummaryOpen = useWorkspaceStore((s) => s.setSummaryOpen);
  const chatOpen = useWorkspaceStore((s) => s.chatOpen);
  const setChatOpen = useWorkspaceStore((s) => s.setChatOpen);
  const mobilePane = useWorkspaceStore((s) => s.mobilePane);
  const setMobilePane = useWorkspaceStore((s) => s.setMobilePane);
  const clearCodexWindows = useWorkspaceStore((s) => s.clearCodexWindows);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/novels/${novelId}`);
    if (!res.ok) {
      setData(null);
      setLoadError("Could not load this novel.");
      return null;
    }
    setLoadError("");
    const tree = (await res.json()) as Tree;
    setData(tree);
    return tree;
  }, [novelId]);

  useEffect(() => {
    setNovel(novelId);
    clearCodexWindows();
  }, [novelId, setNovel, clearCodexWindows]);

  const refreshCommands = useCallback(async () => {
    try {
      const s = await fetch("/api/settings").then((r) => r.json());
      setCommands((s.commands ?? []) as SavedAction[]);
      setModel(s.settings?.defaultModel ?? "anthropic/claude-sonnet-4");
      setHasApiKey(Boolean(s.settings?.openrouterApiKey));
    } catch {
      setHasApiKey(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    void refreshCommands();
  }, [refresh, refreshCommands]);

  useEffect(() => {
    if (!data || activeChapterId) return;
    const firstAct = data.acts.find((act) => act.chapters[0]);
    const firstChapter = firstAct?.chapters[0];
    if (firstAct && firstChapter) {
      setActive({
        chapterId: firstChapter.id,
        actId: firstAct.id,
        sceneId: firstChapter.prose?.id ?? firstChapter.scenes[0]?.id ?? null,
      });
    }
  }, [data, activeChapterId, setActive]);

  const chapterOptions = useMemo(() => {
    if (!data) return [];
    return data.acts.flatMap((act, actIndex) =>
      act.chapters.map((ch, chapterIndex) => ({
        id: ch.id,
        actId: act.id,
        label: `${actLabel(actIndex, act.title)} / ${chapterLabel(chapterIndex, ch.title)}`,
        proseId: ch.prose?.id ?? ch.scenes[0]?.id ?? null,
      })),
    );
  }, [data]);

  const activeChapter = useMemo(() => {
    if (!data) return null;
    if (activeChapterId) {
      for (const act of data.acts) {
        const ch = act.chapters.find((c) => c.id === activeChapterId);
        if (ch) {
          return {
            ...ch,
            actId: act.id,
            actTitle: act.title,
            actSummary: act.summary ?? "",
            actIndex: data.acts.indexOf(act),
            chapterIndex: act.chapters.indexOf(ch),
          };
        }
      }
    }
    const act = data.acts.find((a) => a.chapters[0]);
    const ch = act?.chapters[0];
    return ch && act
      ? {
          ...ch,
          actId: act.id,
          actTitle: act.title,
          actSummary: act.summary ?? "",
          actIndex: data.acts.indexOf(act),
          chapterIndex: act.chapters.indexOf(ch),
        }
      : null;
  }, [data, activeChapterId]);

  const prose = activeChapter?.prose ?? activeChapter?.scenes[0] ?? null;

  async function saveChapterMeta(chapterId: string, title: string, goal: string) {
    await fetch(`/api/novels/${novelId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "upsertChapter",
        payload: { id: chapterId, title: title.trim(), goal },
      }),
    });
    await refresh();
  }

  async function saveActMeta(actId: string, name: string) {
    await fetch(`/api/novels/${novelId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "upsertAct",
        payload: { id: actId, title: name.trim() },
      }),
    });
    await refresh();
  }

  async function addAct() {
    const created = await fetch(`/api/novels/${novelId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "upsertAct", payload: { title: "" } }),
    }).then((r) => r.json());
    const tree = await refresh();
    const act = tree?.acts.find((a) => a.id === created.id);
    const chapter = act?.chapters[0];
    if (act && chapter) {
      setActive({
        chapterId: chapter.id,
        actId: act.id,
        sceneId: chapter.prose?.id ?? chapter.scenes[0]?.id ?? null,
      });
    }
  }

  async function addChapter(actId: string) {
    const created = await fetch(`/api/novels/${novelId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "upsertChapter",
        payload: { actId, title: "" },
      }),
    }).then((r) => r.json());
    const tree = await refresh();
    const chapter = tree?.acts
      .find((a) => a.id === actId)
      ?.chapters.find((c) => c.id === created.id);
    if (chapter) {
      setActive({
        chapterId: chapter.id,
        actId,
        sceneId: chapter.prose?.id ?? chapter.scenes[0]?.id ?? null,
      });
    }
  }

  async function moveAct(actIndex: number, dir: -1 | 1) {
    if (!data) return;
    const next = [...data.acts];
    const dest = actIndex + dir;
    if (dest < 0 || dest >= next.length) return;
    [next[actIndex], next[dest]] = [next[dest], next[actIndex]];
    await fetch(`/api/novels/${novelId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "reorderActs",
        payload: { orderedIds: next.map((a) => a.id) },
      }),
    });
    await refresh();
  }

  async function moveChapter(actIndex: number, chapterIndex: number, dir: -1 | 1) {
    if (!data) return;
    const act = data.acts[actIndex];
    const chapter = act?.chapters[chapterIndex];
    if (!act || !chapter) return;
    const dest = chapterIndex + dir;
    if (dest >= 0 && dest < act.chapters.length) {
      const ids = act.chapters.map((c) => c.id);
      [ids[chapterIndex], ids[dest]] = [ids[dest], ids[chapterIndex]];
      await fetch(`/api/novels/${novelId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reorderChapters",
          payload: { actId: act.id, orderedIds: ids },
        }),
      });
    } else if (dir === -1 && actIndex > 0) {
      const prev = data.acts[actIndex - 1];
      await fetch(`/api/novels/${novelId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "moveChapter",
          payload: { chapterId: chapter.id, destActId: prev.id, destIndex: prev.chapters.length },
        }),
      });
    } else if (dir === 1 && actIndex < data.acts.length - 1) {
      const nextAct = data.acts[actIndex + 1];
      await fetch(`/api/novels/${novelId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "moveChapter",
          payload: { chapterId: chapter.id, destActId: nextAct.id, destIndex: 0 },
        }),
      });
    } else {
      return;
    }
    await refresh();
  }

  function selectChapter(chapterId: string) {
    const opt = chapterOptions.find((c) => c.id === chapterId);
    if (!opt) return;
    setActive({ chapterId: opt.id, actId: opt.actId, sceneId: opt.proseId });
    setMobilePane("manuscript");
  }

  function jumpToProse(sceneId: string) {
    if (!data) return;
    for (const act of data.acts) {
      for (const ch of act.chapters) {
        if (ch.prose?.id === sceneId || ch.scenes.some((s) => s.id === sceneId)) {
          setActive({ chapterId: ch.id, actId: act.id, sceneId });
          setMobilePane("manuscript");
          return;
        }
      }
    }
  }

  if (!data) {
    return (
      <div className="flex min-h-dvh flex-col">
        <AppHeader />
        <div className="p-8">
          <p className="text-muted">{loadError || "Loading manuscript…"}</p>
          {loadError ? (
            <Link href="/" className="mt-3 inline-block text-sm text-accent hover:underline">
              Back to novels
            </Link>
          ) : null}
        </div>
      </div>
    );
  }

  const showLeftDesktop = leftOpen;
  const showBeatsDesktop = beatsOpen;
  const showSummaryDesktop = summaryOpen;
  const showChatDesktop = chatOpen;
  const showCodexMobile = mobilePane === "codex";
  const showChatMobile = mobilePane === "chat";
  const showPlanMobile = mobilePane === "plan";
  const showManuscriptMobile = mobilePane === "manuscript";

  const leftClass = (mobile: boolean) =>
    `${mobile ? "flex w-full" : "hidden"} ${showLeftDesktop ? "lg:flex lg:w-auto" : "lg:hidden"}`;

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <AppHeader
        novelId={novelId}
        novelTitle={data.novel.title}
        mode="write"
        tools={
          <WriteDeskTools
            acts={data.acts.map((act) => ({
              id: act.id,
              title: act.title,
              chapters: act.chapters.map((ch) => ({
                id: ch.id,
                title: ch.title,
                goal: ch.goal,
                summary: ch.summary,
                proseId: ch.prose?.id ?? ch.scenes[0]?.id ?? null,
              })),
            }))}
            activeChapterId={activeChapter?.id ?? ""}
            model={model}
            hasApiKey={hasApiKey}
            onSelectChapter={selectChapter}
            onAddChapter={(actId) => void addChapter(actId)}
            onAddAct={() => void addAct()}
            onMoveAct={(index, dir) => void moveAct(index, dir)}
            onMoveChapter={(actIndex, chapterIndex, dir) => void moveChapter(actIndex, chapterIndex, dir)}
            onModelChange={setModel}
          />
        }
      />

      <div className="border-b border-border p-2 lg:hidden">
        <div
          className="flex gap-0.5 rounded-md border border-border bg-surface p-0.5"
          role="tablist"
          aria-label="Write panels"
        >
          {MOBILE_TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={mobilePane === id}
              className={`flex-1 rounded px-2 py-1.5 text-sm transition ${
                mobilePane === id ? "bg-accent-soft text-accent" : "text-muted hover:text-text"
              }`}
              onClick={() => setMobilePane(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 overflow-x-auto">
        {!showLeftDesktop ? (
          <RailStrip label="Codex" side="left" onClick={() => setLeftOpen(true)} />
        ) : null}

        <div className={leftClass(showCodexMobile)}>
          {showLeftDesktop || showCodexMobile ? (
            leftTab === "codex" ? (
              <KnowledgeSidebar
                entries={data.knowledge}
                story={data.novel}
                onCollapse={() => {
                  setLeftOpen(false);
                  setMobilePane("manuscript");
                }}
                className={showCodexMobile && !showLeftDesktop ? "w-full border-r-0" : undefined}
              />
            ) : (
              <ActionsSidebar
                actions={commands}
                onCollapse={() => {
                  setLeftOpen(false);
                  setMobilePane("manuscript");
                }}
                className={showCodexMobile && !showLeftDesktop ? "w-full border-r-0" : undefined}
              />
            )
          ) : null}
        </div>

        <main
          className={`min-h-0 min-w-0 flex-1 overflow-y-auto ${
            showManuscriptMobile ? "block" : "hidden lg:block"
          }`}
        >
          <div className="mx-auto max-w-3xl px-6 pb-12">
            <div className="pt-8">
              {status ? (
                <p className="mb-4 text-sm text-accent" role="status">
                  {status}
                </p>
              ) : null}
              {!hasApiKey ? (
                <p className="mb-4 text-xs text-muted">
                  Add an OpenRouter key in{" "}
                  <Link href="/settings" className="text-accent hover:underline">
                    Settings
                  </Link>{" "}
                  to use chat and Actions.
                </p>
              ) : null}
              {data.acts.length === 0 ? (
                <div className="rounded-lg border border-border bg-surface/50 p-6 panel-enter">
                  <p className="font-serif text-xl">No chapters yet</p>
                  <p className="mt-2 max-w-md text-sm text-muted">
                    Add an act to start drafting. Each chapter is one writing document.
                  </p>
                  <button
                    type="button"
                    className="mt-4 rounded-md bg-accent px-3 py-1.5 text-sm text-bg"
                    onClick={() => void addAct()}
                  >
                    Add Act 1
                  </button>
                </div>
              ) : activeChapter ? (
                <>
                  <ChapterHeader
                    key={`hdr-${activeChapter.id}`}
                    actIndex={activeChapter.actIndex}
                    chapterIndex={activeChapter.chapterIndex}
                    initialActName={actName(activeChapter.actTitle)}
                    initialChapterName={chapterName(activeChapter.title)}
                    initialGoal={activeChapter.goal ?? ""}
                    onSaveAct={(name) => void saveActMeta(activeChapter.actId, name)}
                    onSaveChapter={(title, goal) =>
                      void saveChapterMeta(activeChapter.id, title, goal)
                    }
                  />
                  {prose ? (
                    <ChapterEditor
                      key={prose.id}
                      novelId={novelId}
                      proseId={prose.id}
                      chapterId={activeChapter.id}
                      actId={activeChapter.actId}
                      initialContent={prose.content}
                      hasApiKey={hasApiKey}
                      draftResult={draftResult}
                      onDraftHandled={() => setDraftResult(null)}
                      onSaved={() => void refresh()}
                    />
                  ) : (
                    <p className="text-sm text-muted">This chapter has no prose document yet.</p>
                  )}
                </>
              ) : null}
            </div>
          </div>
        </main>

        <div
          className={`${
            showPlanMobile ? "flex w-full min-h-0 flex-1 flex-col overflow-y-auto" : "hidden"
          } lg:contents`}
        >
        {!showBeatsDesktop ? (
          <RailStrip label="Beats" side="right" onClick={() => setBeatsOpen(true)} />
        ) : null}
        <div
          className={`${showPlanMobile ? "flex min-h-0 w-full flex-1" : "hidden"} ${
            showBeatsDesktop ? "lg:flex lg:w-auto lg:flex-none" : "lg:hidden"
          }`}
        >
          {showBeatsDesktop || showPlanMobile ? (
            <BeatsSidebar
              key={activeChapter?.id ?? "beats"}
              novelId={novelId}
              chapterId={activeChapter?.id ?? null}
              chapterTitle={
                activeChapter
                  ? chapterLabel(activeChapter.chapterIndex, activeChapter.title)
                  : undefined
              }
              chapterSummary={activeChapter?.summary ?? ""}
              beats={activeChapter?.beats ?? []}
              hasApiKey={hasApiKey}
              onChange={() => void refresh()}
              onCollapse={() => {
                setBeatsOpen(false);
                setMobilePane("manuscript");
              }}
              className={showPlanMobile && !showBeatsDesktop ? "w-full border-l-0" : undefined}
            />
          ) : null}
        </div>

        {!showSummaryDesktop ? (
          <RailStrip label="Summary" side="right" onClick={() => setSummaryOpen(true)} />
        ) : null}
        <div
          className={`${showPlanMobile ? "flex min-h-0 w-full flex-1" : "hidden"} ${
            showSummaryDesktop ? "lg:flex lg:w-auto lg:flex-none" : "lg:hidden"
          }`}
        >
          {showSummaryDesktop || showPlanMobile ? (
            <ChapterSummaryRail
              key={`sum-${activeChapter?.id ?? "none"}`}
              novelId={novelId}
              chapterId={activeChapter?.id ?? null}
              chapterTitle={
                activeChapter
                  ? chapterLabel(activeChapter.chapterIndex, activeChapter.title)
                  : undefined
              }
              chapterSummary={activeChapter?.summary ?? ""}
              actId={activeChapter?.actId ?? null}
              actTitle={
                activeChapter
                  ? actLabel(activeChapter.actIndex, activeChapter.actTitle)
                  : undefined
              }
              actSummary={activeChapter?.actSummary ?? ""}
              onChange={() => void refresh()}
              onCollapse={() => setSummaryOpen(false)}
              className={showPlanMobile && !showSummaryDesktop ? "w-full border-l-0" : undefined}
            />
          ) : null}
        </div>
        </div>

        {!showChatDesktop ? (
          <RailStrip label="Chat" side="right" onClick={() => setChatOpen(true)} />
        ) : null}
        <div
          className={`${showChatMobile ? "flex w-full" : "hidden"} ${
            showChatDesktop ? "lg:flex lg:w-auto" : "lg:hidden"
          }`}
        >
          {showChatDesktop || showChatMobile ? (
            <ChapterChat
              key={activeChapter?.id ?? "chat"}
              novelId={novelId}
              chapterId={activeChapter?.id ?? null}
              proseId={prose?.id ?? null}
              commands={commands}
              model={model}
              hasApiKey={hasApiKey}
              onChange={() => void refresh()}
              onDraft={setDraftResult}
              onCollapse={() => {
                setChatOpen(false);
                setMobilePane("manuscript");
              }}
              className={showChatMobile && !showChatDesktop ? "w-full border-l-0" : undefined}
            />
          ) : null}
        </div>
      </div>
      <WorkspaceSheets
        novelId={novelId}
        entries={data.knowledge}
        story={data.novel}
        actions={commands}
        onCodexChange={() => void refresh()}
        onActionsChange={() => void refreshCommands()}
        onJumpToProse={jumpToProse}
      />
    </div>
  );
}

function ChapterHeader({
  actIndex,
  chapterIndex,
  initialActName,
  initialChapterName,
  initialGoal,
  onSaveAct,
  onSaveChapter,
}: {
  actIndex: number;
  chapterIndex: number;
  initialActName: string;
  initialChapterName: string;
  initialGoal: string;
  onSaveAct: (name: string) => void;
  onSaveChapter: (title: string, goal: string) => void;
}) {
  const [actNameDraft, setActNameDraft] = useState(initialActName);
  const [titleDraft, setTitleDraft] = useState(initialChapterName);
  const [goalDraft, setGoalDraft] = useState(initialGoal);

  const blurOnEnter = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.blur();
    }
  };

  return (
    <header className="mb-6 border-b border-border pb-4">
      <input
        aria-label="Act name"
        className="w-full bg-transparent text-xs uppercase tracking-wide text-muted outline-none placeholder:text-muted/60 focus:text-text"
        value={actNameDraft}
        placeholder={`Act ${actIndex + 1}`}
        onChange={(e) => setActNameDraft(e.target.value)}
        onBlur={() => {
          if (actNameDraft !== initialActName) onSaveAct(actNameDraft);
        }}
        onKeyDown={blurOnEnter}
      />
      <input
        aria-label="Chapter title"
        className="mt-1 w-full bg-transparent font-display text-4xl leading-tight tracking-tight outline-none placeholder:text-muted/50"
        value={titleDraft}
        placeholder={`Chapter ${chapterIndex + 1}`}
        onChange={(e) => setTitleDraft(e.target.value)}
        onBlur={() => {
          if (titleDraft !== initialChapterName || goalDraft !== initialGoal) {
            onSaveChapter(titleDraft, goalDraft);
          }
        }}
        onKeyDown={blurOnEnter}
      />
      <input
        aria-label="Chapter goal"
        className="mt-3 w-full max-w-prose bg-transparent text-sm italic text-muted outline-none placeholder:not-italic placeholder:text-muted/60 focus:text-text"
        value={goalDraft}
        placeholder="Chapter goal — what this chapter must accomplish…"
        onChange={(e) => setGoalDraft(e.target.value)}
        onBlur={() => {
          if (goalDraft !== initialGoal || titleDraft !== initialChapterName) {
            onSaveChapter(titleDraft, goalDraft);
          }
        }}
        onKeyDown={blurOnEnter}
      />
    </header>
  );
}

function WriteDeskTools({
  acts,
  activeChapterId,
  model,
  hasApiKey,
  onSelectChapter,
  onAddChapter,
  onAddAct,
  onMoveAct,
  onMoveChapter,
  onModelChange,
}: {
  acts: Array<{
    id: string;
    title: string;
    chapters: Array<{
      id: string;
      title: string;
      goal: string | null;
      summary: string | null;
      proseId: string | null;
    }>;
  }>;
  activeChapterId: string;
  model: string;
  hasApiKey: boolean;
  onSelectChapter: (chapterId: string) => void;
  onAddChapter: (actId: string) => void;
  onAddAct: () => void;
  onMoveAct: (actIndex: number, dir: -1 | 1) => void;
  onMoveChapter: (actIndex: number, chapterIndex: number, dir: -1 | 1) => void;
  onModelChange: (model: string) => void;
}) {
  return (
    <>
      <ManuscriptMenu
        acts={acts}
        activeChapterId={activeChapterId}
        onSelectChapter={onSelectChapter}
        onAddAct={onAddAct}
        onAddChapter={onAddChapter}
        onMoveAct={onMoveAct}
        onMoveChapter={onMoveChapter}
      />
      <label className="hidden min-w-0 lg:block">
        <span className="sr-only">Model</span>
        <input
          className="w-40 rounded border border-border bg-surface px-2 py-1 text-sm text-text hover:text-text disabled:opacity-50 disabled:hover:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          value={model}
          disabled={!hasApiKey}
          onChange={(e) => onModelChange(e.target.value)}
          spellCheck={false}
          aria-label="Model"
        />
      </label>
    </>
  );
}
