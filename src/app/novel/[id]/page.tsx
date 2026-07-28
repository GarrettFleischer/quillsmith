"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

export default function WritePage() {
  const params = useParams<{ id: string }>();
  const novelId = params.id;
  const [data, setData] = useState<Tree | null>(null);
  const [commands, setCommands] = useState<
    Array<{ slug: string; label: string; description: string | null }>
  >([]);
  const [model, setModel] = useState("anthropic/claude-sonnet-4");
  const activeChapterId = useEditorStore((s) => s.activeChapterId);
  const status = useEditorStore((s) => s.status);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/novels/${novelId}`);
    setData(await res.json());
  }, [novelId]);

  useEffect(() => {
    void refresh();
    void fetch("/api/settings")
      .then((r) => r.json())
      .then((s) => {
        setCommands(s.commands ?? []);
        setModel(s.settings?.defaultModel ?? model);
      });
  }, [refresh]);

  const activeChapter = useMemo(() => {
    if (!data || !activeChapterId) return null;
    for (const act of data.acts) {
      const ch = act.chapters.find((c) => c.id === activeChapterId);
      if (ch) return ch;
    }
    // default first chapter
    return data.acts[0]?.chapters[0] ?? null;
  }, [data, activeChapterId]);

  function jumpToScene(sceneId: string) {
    const el = document.querySelector(`[data-scene-id="${sceneId}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (!data) {
    return (
      <div className="min-h-full">
        <AppHeader />
        <p className="p-8 text-muted">Loading manuscript…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader novelId={novelId} novelTitle={data.novel.title} mode="write" />
      <div className="flex min-h-0 flex-1">
        <KnowledgeSidebar
          novelId={novelId}
          entries={data.knowledge}
          onChange={() => void refresh()}
          onJumpToScene={jumpToScene}
        />
        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-6 py-8">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-display text-3xl">{data.novel.title}</p>
                {status ? <p className="mt-1 text-sm text-accent">{status}</p> : null}
              </div>
              <label className="text-xs text-muted">
                Model
                <input
                  className="ml-2 w-56 rounded border border-border bg-surface px-2 py-1 text-sm text-text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                />
              </label>
            </div>

            {data.acts.length === 0 ? (
              <p className="text-muted">
                No acts yet. Open Overview to plan the structure, then return here to write.
              </p>
            ) : null}

            {data.acts.map((act) => (
              <section key={act.id} className="mb-10">
                <header className="mb-4 border-b border-border pb-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted">Act</p>
                  <h1 className="font-display text-4xl">{act.title}</h1>
                  {act.brief ? (
                    <p className="mt-2 text-sm text-muted">{act.brief}</p>
                  ) : null}
                </header>
                {act.chapters.map((chapter) => (
                  <section key={chapter.id} className="mb-8">
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
                        onSaved={() => void refresh()}
                      />
                    ))}
                  </section>
                ))}
              </section>
            ))}
          </div>
        </main>
        <BeatsSidebar
          novelId={novelId}
          chapterId={activeChapter?.id ?? null}
          chapterTitle={activeChapter?.title}
          beats={activeChapter?.beats ?? []}
          onChange={() => void refresh()}
        />
      </div>
    </div>
  );
}
