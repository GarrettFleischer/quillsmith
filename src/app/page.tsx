"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppHeader } from "@/components/app-header";

type Novel = {
  id: string;
  title: string;
  premise: string | null;
  updatedAt: string | Date;
};

export default function HomePage() {
  const router = useRouter();
  const [novels, setNovels] = useState<Novel[]>([]);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const res = await fetch("/api/novels");
    setNovels(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function createNovel() {
    const res = await fetch("/api/novels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim() || "Untitled novel" }),
    });
    const novel = await res.json();
    router.push(`/novel/${novel.id}/overview`);
  }

  return (
    <div className="min-h-full">
      <AppHeader />
      <main className="mx-auto max-w-3xl px-4 py-12 panel-enter">
        <p className="font-display text-5xl leading-none tracking-tight text-text">
          Quillsmith
        </p>
        <p className="mt-3 max-w-xl text-lg text-muted">
          Plan top-down — acts, chapters, beats — then draft scenes with a knowledge base
          that stays with the story.
        </p>

        <div className="mt-10 flex gap-2">
          <input
            className="flex-1 rounded-md border border-border bg-surface px-3 py-2 outline-none ring-accent focus:ring-2"
            placeholder="New novel title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void createNovel();
            }}
          />
          <button
            type="button"
            onClick={() => void createNovel()}
            className="rounded-md bg-accent px-4 py-2 font-medium text-bg"
          >
            Create
          </button>
        </div>

        <section className="mt-12">
          <h2 className="font-serif text-xl">Your novels</h2>
          {loading ? (
            <p className="mt-4 text-muted">Loading…</p>
          ) : novels.length === 0 ? (
            <p className="mt-4 text-muted">No novels yet. Start with a title above.</p>
          ) : (
            <ul className="mt-4 divide-y divide-border border-y border-border">
              {novels.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    className="flex w-full items-baseline justify-between gap-4 py-4 text-left hover:bg-surface/60"
                    onClick={() => router.push(`/novel/${n.id}/overview`)}
                  >
                    <span>
                      <span className="block font-serif text-lg">{n.title}</span>
                      {n.premise ? (
                        <span className="mt-1 line-clamp-1 block text-sm text-muted">
                          {n.premise}
                        </span>
                      ) : null}
                    </span>
                    <span className="shrink-0 text-xs text-muted">
                      {new Date(n.updatedAt).toLocaleDateString()}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
