"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ActionsSidebar } from "@/components/actions-sidebar";
import { AppHeader } from "@/components/app-header";
import { BeatsSidebar, type Beat } from "@/components/beats-sidebar";
import { ChapterChat } from "@/components/chapter-chat";
import { ChapterEditor, type DraftResult } from "@/components/chapter-editor";
import { ChapterSummaryRail } from "@/components/chapter-summary";
import { KnowledgeSidebar, type KnowledgeEntry, type StoryFields } from "@/components/knowledge-sidebar";
import { RailStrip } from "@/components/rail-strip";
import { WorkspaceSheets } from "@/components/workspace-sheets";
import { useEditorStore } from "@/store/editor";
import { useWorkspaceStore } from "@/store/workspace";
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
      return;
    }
    setLoadError("");
    setData(await res.json());
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
    const firstAct = data.acts[0];
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
    return data.acts.flatMap((act) =>
      act.chapters.map((ch) => ({
        id: ch.id,
        actId: act.id,
        label: `${act.title} / ${ch.title}`,
        proseId: ch.prose?.id ?? ch.scenes[0]?.id ?? null,
      })),
    );
  }, [data]);

  const activeChapter = useMemo(() => {
    if (!data) return null;
    if (activeChapterId) {
      for (const act of data.acts) {
        const ch = act.chapters.find((c) => c.id === activeChapterId);
        if (ch) return { ...ch, actId: act.id, actTitle: act.title };
      }
    }
    const act = data.acts[0];
    const ch = act?.chapters[0];
    return ch && act ? { ...ch, actId: act.id, actTitle: act.title } : null;
  }, [data, activeChapterId]);

  const prose = activeChapter?.prose ?? activeChapter?.scenes[0] ?? null;

  async function addAct() {
    const n = (data?.acts.length ?? 0) + 1;
    await fetch(`/api/novels/${novelId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "upsertAct", payload: { title: `Act ${n}` } }),
    });
    await refresh();
  }

  async function addChapter() {
    if (!activeChapter) return;
    const act = data?.acts.find((a) => a.id === activeChapter.actId);
    const n = (act?.chapters.length ?? 0) + 1;
    await fetch(`/api/novels/${novelId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "upsertChapter",
        payload: { actId: activeChapter.actId, title: `Chapter ${n}` },
      }),
    });
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
      <AppHeader novelId={novelId} novelTitle={data.novel.title} mode="write" />

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
            <div className="sticky top-0 z-10 -mx-6 border-b border-border bg-bg/95 px-6 py-4 backdrop-blur-sm">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="font-display text-3xl leading-none tracking-tight">
                    {data.novel.title}
                  </p>
                  {status ? (
                    <p className="mt-2 text-sm text-accent" role="status">
                      {status}
                    </p>
                  ) : null}
                  {!hasApiKey ? (
                    <p className="mt-2 text-xs text-muted">
                      Add an OpenRouter key in{" "}
                      <Link href="/settings" className="text-accent hover:underline">
                        Settings
                      </Link>{" "}
                      to use chat and Actions.
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-end gap-3">
                  {chapterOptions.length > 0 ? (
                    <label className="block text-xs text-muted">
                      Chapter
                      <select
                        className="mt-1 block max-w-[16rem] rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        value={activeChapter?.id ?? ""}
                        onChange={(e) => selectChapter(e.target.value)}
                      >
                        {chapterOptions.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  <button
                    type="button"
                    className="rounded-md border border-border px-2 py-1 text-xs text-muted hover:text-text"
                    onClick={() => void addChapter()}
                    disabled={!activeChapter}
                  >
                    Add chapter
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-border px-2 py-1 text-xs text-muted hover:text-text"
                    onClick={() => void addAct()}
                  >
                    Add act
                  </button>
                  <label className="block text-xs text-muted">
                    Model
                    <input
                      className="mt-1 block w-44 rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-text disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      value={model}
                      disabled={!hasApiKey}
                      onChange={(e) => setModel(e.target.value)}
                      spellCheck={false}
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="pt-8">
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
                  <header className="mb-6 border-b border-border pb-4">
                    <p className="text-xs uppercase tracking-wide text-muted">
                      {activeChapter.actTitle}
                    </p>
                    <h1 className="mt-1 font-display text-4xl leading-tight tracking-tight">
                      {activeChapter.title}
                    </h1>
                    {activeChapter.goal ? (
                      <p className="mt-3 max-w-prose text-sm italic text-muted">
                        {activeChapter.goal}
                      </p>
                    ) : null}
                  </header>
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
              chapterTitle={activeChapter?.title}
              beats={activeChapter?.beats ?? []}
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
              chapterTitle={activeChapter?.title}
              chapterSummary={activeChapter?.summary ?? ""}
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
