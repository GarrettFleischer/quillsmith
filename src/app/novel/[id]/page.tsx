"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { BeatsSidebar, type Beat } from "@/components/beats-sidebar";
import { KnowledgeSidebar, type KnowledgeEntry } from "@/components/knowledge-sidebar";
import { SceneEditor } from "@/components/scene-editor";
import { useEditorStore } from "@/store/editor";

type Tree = {
  novel: { id: string; title: string };
  acts: Array<{
    id: string;
    title: string;
    brief: string | null;
    chapters: Array<{
      id: string;
      title: string;
      goal: string | null;
      beats: Beat[];
      scenes: Array<{
        id: string;
        title: string | null;
        content: string;
        chapterId: string;
      }>;
    }>;
  }>;
  knowledge: KnowledgeEntry[];
};

type MobilePane = "manuscript" | "knowledge" | "beats";

const MOBILE_TABS: { id: MobilePane; label: string }[] = [
  { id: "manuscript", label: "Manuscript" },
  { id: "knowledge", label: "Knowledge" },
  { id: "beats", label: "Beats" },
];

export default function WritePage() {
  const params = useParams<{ id: string }>();
  const novelId = params.id;
  const [data, setData] = useState<Tree | null>(null);
  const [loadError, setLoadError] = useState("");
  const [commands, setCommands] = useState<
    Array<{ slug: string; label: string; description: string | null }>
  >([]);
  const [model, setModel] = useState("anthropic/claude-sonnet-4");
  const [hasApiKey, setHasApiKey] = useState(true);
  const [kbOpen, setKbOpen] = useState(false);
  const [mobilePane, setMobilePane] = useState<MobilePane>("manuscript");
  const activeChapterId = useEditorStore((s) => s.activeChapterId);
  const activeSceneId = useEditorStore((s) => s.activeSceneId);
  const setActive = useEditorStore((s) => s.setActive);
  const status = useEditorStore((s) => s.status);

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
    void refresh();
    void fetch("/api/settings")
      .then((r) => r.json())
      .then((s) => {
        setCommands(s.commands ?? []);
        setModel(s.settings?.defaultModel ?? "anthropic/claude-sonnet-4");
        setHasApiKey(Boolean(s.settings?.openrouterApiKey));
      })
      .catch(() => setHasApiKey(false));
  }, [refresh]);

  useEffect(() => {
    if (!data || activeChapterId) return;
    const firstAct = data.acts[0];
    const firstChapter = firstAct?.chapters[0];
    if (firstAct && firstChapter) {
      setActive({
        chapterId: firstChapter.id,
        actId: firstAct.id,
        sceneId: firstChapter.scenes[0]?.id ?? null,
      });
    }
  }, [data, activeChapterId, setActive]);

  const chapterOptions = useMemo(() => {
    if (!data) return [];
    return data.acts.flatMap((act) =>
      act.chapters.map((ch) => ({
        id: ch.id,
        actId: act.id,
        label: `${act.title} · ${ch.title}`,
        firstSceneId: ch.scenes[0]?.id ?? null,
      })),
    );
  }, [data]);

  const activeChapter = useMemo(() => {
    if (!data) return null;
    if (activeChapterId) {
      for (const act of data.acts) {
        const ch = act.chapters.find((c) => c.id === activeChapterId);
        if (ch) return ch;
      }
    }
    return data.acts[0]?.chapters[0] ?? null;
  }, [data, activeChapterId]);

  const createScene = useCallback(
    async (chapterId: string) => {
      await fetch(`/api/novels/${novelId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "createScene",
          payload: { chapterId },
        }),
      });
      void refresh();
    },
    [novelId, refresh],
  );

  function jumpToScene(sceneId: string) {
    setMobilePane("manuscript");
    requestAnimationFrame(() => {
      document
        .querySelector(`[data-scene-id="${sceneId}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function jumpToChapter(chapterId: string) {
    const opt = chapterOptions.find((c) => c.id === chapterId);
    if (!opt) return;
    setActive({ chapterId: opt.id, actId: opt.actId, sceneId: opt.firstSceneId });
    setMobilePane("manuscript");
    requestAnimationFrame(() => {
      document
        .querySelector(`[data-chapter-id="${chapterId}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
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

  const showKbDesktop = kbOpen;
  const showKbMobile = mobilePane === "knowledge";
  const showBeatsMobile = mobilePane === "beats";
  const showManuscriptMobile = mobilePane === "manuscript";

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
                mobilePane === id
                  ? "bg-accent-soft text-accent"
                  : "text-muted hover:text-text"
              }`}
              onClick={() => setMobilePane(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {!showKbDesktop ? (
          <div className="hidden shrink-0 flex-col border-r border-border bg-surface/70 lg:flex">
            <button
              type="button"
              className="flex h-full w-10 items-center justify-center px-1 text-xs tracking-wide text-muted transition hover:bg-surface-2 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
              aria-label="Open knowledge base"
              onClick={() => setKbOpen(true)}
            >
              <span className="ledger-rail-label">Knowledge</span>
            </button>
          </div>
        ) : null}

        <div
          className={`min-h-0 ${
            showKbMobile ? "flex w-full" : "hidden"
          } ${showKbDesktop ? "lg:flex lg:w-auto" : "lg:hidden"}`}
        >
          {showKbDesktop || showKbMobile ? (
            <KnowledgeSidebar
              novelId={novelId}
              entries={data.knowledge}
              onChange={() => void refresh()}
              onJumpToScene={jumpToScene}
              onCollapse={() => {
                setKbOpen(false);
                setMobilePane("manuscript");
              }}
              className={showKbMobile && !showKbDesktop ? "w-full border-r-0" : undefined}
            />
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
                      to use slash commands.
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-end gap-3">
                  <button
                    type="button"
                    className="hidden rounded-md border border-border px-2 py-1 text-xs text-muted transition hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent lg:inline-flex"
                    onClick={() => setKbOpen((o) => !o)}
                  >
                    {kbOpen ? "Hide knowledge" : "Show knowledge"}
                  </button>
                  {chapterOptions.length > 0 ? (
                    <label className="block text-xs text-muted">
                      Jump to chapter
                      <select
                        className="mt-1 block max-w-[14rem] rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        value={activeChapter?.id ?? ""}
                        onChange={(e) => jumpToChapter(e.target.value)}
                      >
                        {chapterOptions.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
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
                  <p className="font-serif text-xl">No structure yet</p>
                  <p className="mt-2 max-w-md text-sm text-muted">
                    Plan acts, chapters, and beats in Overview, then return here to draft scenes.
                  </p>
                  <Link
                    href={`/novel/${novelId}/overview`}
                    className="mt-4 inline-block rounded-md bg-accent px-3 py-1.5 text-sm text-bg"
                  >
                    Open Overview
                  </Link>
                </div>
              ) : null}

              {data.acts.map((act) => (
                <section key={act.id} className="mb-12">
                  <header className="mb-6 border-b border-border pb-4">
                    <h1 className="font-display text-4xl leading-tight tracking-tight">
                      {act.title}
                    </h1>
                    {act.brief ? (
                      <p className="mt-3 max-w-prose text-sm leading-relaxed text-muted">
                        {act.brief}
                      </p>
                    ) : null}
                  </header>
                  {act.chapters.map((chapter) => {
                    const isActiveChapter = activeChapter?.id === chapter.id;
                    return (
                      <section
                        key={chapter.id}
                        className={`mb-10 scroll-mt-36 rounded-lg transition-colors ${
                          isActiveChapter ? "bg-surface/25 px-3 py-2 -mx-3" : ""
                        }`}
                        data-chapter-id={chapter.id}
                      >
                        <div className="mb-3 flex items-baseline justify-between gap-3">
                          <h2 className="font-serif text-2xl">{chapter.title}</h2>
                          <button
                            type="button"
                            className="shrink-0 text-xs text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                            onClick={() => void createScene(chapter.id)}
                          >
                            + Scene
                          </button>
                        </div>
                        {chapter.goal ? (
                          <p className="mb-4 text-sm italic text-muted">Goal: {chapter.goal}</p>
                        ) : null}
                        {chapter.scenes.length === 0 ? (
                          <p className="mb-4 text-sm text-muted">
                            No scenes yet.{" "}
                            <button
                              type="button"
                              className="text-accent hover:underline"
                              onClick={() => void createScene(chapter.id)}
                            >
                              Add a scene
                            </button>
                          </p>
                        ) : null}
                        {chapter.scenes.map((scene) => (
                          <SceneEditor
                            key={scene.id}
                            novelId={novelId}
                            sceneId={scene.id}
                            chapterId={chapter.id}
                            actId={act.id}
                            initialContent={scene.content}
                            title={scene.title || "Scene"}
                            commands={commands}
                            model={model}
                            hasApiKey={hasApiKey}
                            isActive={activeSceneId === scene.id}
                            onSaved={() => void refresh()}
                          />
                        ))}
                      </section>
                    );
                  })}
                </section>
              ))}
            </div>
          </div>
        </main>

        <div
          className={`min-h-0 ${
            showBeatsMobile ? "flex w-full" : "hidden"
          } lg:flex lg:w-auto`}
        >
          <BeatsSidebar
            novelId={novelId}
            chapterId={activeChapter?.id ?? null}
            chapterTitle={activeChapter?.title}
            beats={activeChapter?.beats ?? []}
            onChange={() => void refresh()}
            className={showBeatsMobile ? "w-full border-l-0" : undefined}
          />
        </div>
      </div>
    </div>
  );
}
