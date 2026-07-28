"use client";

import { useTheme } from "next-themes";
import Link from "next/link";
import { useEffect, useState } from "react";

export function AppHeader({
  novelTitle,
  novelId,
  mode,
}: {
  novelTitle?: string;
  novelId?: string;
  mode?: "overview" | "write";
}) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-4 px-4">
        <Link href="/" className="font-display text-2xl tracking-tight text-text">
          Quillsmith
        </Link>
        {novelTitle ? (
          <div className="hidden min-w-0 flex-1 items-center gap-3 sm:flex">
            <span className="text-muted">/</span>
            <span className="truncate font-serif text-lg">{novelTitle}</span>
            {novelId && mode ? (
              <nav className="ml-4 flex rounded-md border border-border bg-surface p-0.5 text-sm">
                <Link
                  href={`/novel/${novelId}/overview`}
                  className={`rounded px-3 py-1 transition ${
                    mode === "overview" ? "bg-accent-soft text-accent" : "text-muted hover:text-text"
                  }`}
                >
                  Overview
                </Link>
                <Link
                  href={`/novel/${novelId}`}
                  className={`rounded px-3 py-1 transition ${
                    mode === "write" ? "bg-accent-soft text-accent" : "text-muted hover:text-text"
                  }`}
                >
                  Write
                </Link>
              </nav>
            ) : null}
          </div>
        ) : (
          <div className="flex-1" />
        )}
        <div className="flex items-center gap-2 text-sm">
          {novelId ? (
            <>
              <a
                className="rounded border border-border px-2 py-1 text-muted hover:text-text"
                href={`/api/novels/${novelId}/export?format=json`}
              >
                Export JSON
              </a>
              <a
                className="rounded border border-border px-2 py-1 text-muted hover:text-text"
                href={`/api/novels/${novelId}/export?format=markdown`}
              >
                Export MD
              </a>
            </>
          ) : null}
          <Link
            href="/settings"
            className="rounded border border-border px-2 py-1 text-muted hover:text-text"
          >
            Settings
          </Link>
          <button
            type="button"
            className="rounded border border-border px-2 py-1 text-muted hover:text-text"
            onClick={() =>
              setTheme((resolvedTheme ?? theme) === "dark" ? "light" : "dark")
            }
          >
            {mounted ? ((resolvedTheme ?? theme) === "dark" ? "Light" : "Dark") : "Theme"}
          </button>
        </div>
      </div>
    </header>
  );
}
