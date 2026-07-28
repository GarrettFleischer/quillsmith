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

  const chapterOptions = useMemo(() => {
    if (!data) return [];
    return data.acts.flatMap((act) =>
      act.chapters.map((ch) => ({
        id: ch.id,
        actId: act.id,
        label: `${act.title} · ${ch.title}`,
        title: ch.title,
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
      <div className="min-h-full">
        <AppHeader />
        <p className="p-8 text-muted">{loadError || "Loading manuscript…"}</p>
      </div>
    );
  }

  const showKbDesktop = kbOpen;
  const showKbMobile = mobilePane === "knowledge";
  const showBeatsMobile = mobilePane === "beats";
  const showManuscriptMobile = mobilePane === "manuscript";

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader novelId={novelId} novelTitle={data.novel.title} mode="write" />

      <div className="flex border-b border-border lg:hidden">
        {(
          [
            ["manuscript", "Manuscript"],
            ["knowledge", "Knowledge"],
            ["beats", "Beats"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`flex-1 px-2 py-2 text-sm ${
              mobilePane === id ? "bg-accent-soft text-accent" : "text-muted"
            }`}
            onClick={() => setMobilePane(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Desktop KB collapsed strip */}
        {!showKbDesktop ? (
          <div className="hidden shrink-0 flex-col border-r border-border bg-surface/70 lg:flex">
            <button
              type="button"
              className="h-full w-10 rotate-0 px-2 py-4 text-xs tracking-wide text-muted hover:bg-surface-2 hover:text-text"
              aria-label="Open knowledge"
              onClick={() => setKbOpen(true)}
            >
              <span
                className="inline-block"
                style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
              >
                Knowledge
              </span>
            </button>
          </div>
        ) : null}

        <div
          className={`h-full ${
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
          className={`min-w-0 flex-1 overflow-y-auto ${
            showManuscriptMobile ? "block" : "hidden lg:block"
          }`}
        >
          <div className="mx-auto max-w-3xl px-6 py-8">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-display text-3xl tracking-tight">{data.novel.title}</p>
                {status ? <p className="mt-1 text-sm text-accent">{status}</p> : null}
                {!hasApiKey ? (
                  <p className="mt-1 text-xs text-muted">
                    AI slash commands need an OpenRouter key in{" "}
                    <Link href="/settings" className="text-accent hover:underline">
                      Settings
                    </Link>
                    .
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="hidden rounded-md border border-border px-2 py-1 text-xs text-muted hover:text-text lg:inline-flex"
                  onClick={() => setKbOpen((o) => !o)}
                >
                  {kbOpen ? "Hide knowledge" : "Show knowledge"}
                </button>
                {chapterOptions.length > 0 ? (
                  <label className="text-xs text-muted">
                    Chapter
                    <select
                      className="ml-2 max-w-[14rem] rounded-md border border-border bg-surface px-2 py-1 text-sm text-text"
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
                <label className="text-xs text-muted">
                  Model
                  <input
                    className="ml-2 w-44 rounded-md border border-border bg-surface px-2 py-1 text-sm text-text disabled:opacity-50"
                    value={model}
                    disabled={!hasApiKey}
                    onChange={(e) => setModel(e.target.value)}
                  />
                </label>
              </div>
            </div>

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
              <section key={act.id} className="mb-10">
                <header className="mb-4 border-b border-border pb-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted">Act</p>
                  <h1 className="font-display text-4xl tracking-tight">{act.title}</h1>
                  {act.brief ? (
                    <p className="mt-2 text-sm text-muted">{act.brief}</p>
                  ) : null}
                </header>
                {act.chapters.map((chapter) => (
                  <section
                    key={chapter.id}
                    className="mb-8 scroll-mt-24"
                    data-chapter-id={chapter.id}
                  >
                    <div className="mb-2 flex items-baseline justify-between gap-3">
                      <h2 className="font-serif text-2xl">{chapter.title}</h2>
                      <button
                        type="button"
                        className="text-xs text-accent hover:underline"
                        onClick={async () => {
                          await fetch(`/api/novels/${novelId}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              action: "createScene",
                              payload: { chapterId: chapter.id },
                            }),
                          });
                          void refresh();
                        }}
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
                          onClick={async () => {
                            await fetch(`/api/novels/${novelId}`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                action: "createScene",
                                payload: { chapterId: chapter.id },
                              }),
                            });
                            void refresh();
                          }}
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
                        onSaved={() => void refresh()}
                      />
                    ))}
                  </section>
                ))}
              </section>
            ))}
          </div>
        </main>

        <div
          className={`h-full ${
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
