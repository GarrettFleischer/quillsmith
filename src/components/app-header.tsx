"use client";

import { useTheme } from "next-themes";
import Link from "next/link";
import { useEffect, useState } from "react";
import { IconGear } from "@/components/codex-icons";

export function AppHeader({
  novelTitle,
  novelId,
  mode,
}: {
  novelTitle?: string;
  novelId?: string;
  mode?: "write" | "review";
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
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className="hidden text-muted sm:inline">/</span>
            <span className="hidden truncate font-serif text-lg sm:inline">{novelTitle}</span>
            {novelId && mode ? (
              <nav className="flex rounded-md border border-border bg-surface p-0.5 text-sm">
                <Link
                  href={`/novel/${novelId}`}
                  className={`rounded px-3 py-1 transition ${
                    mode === "write" ? "bg-accent-soft text-accent" : "text-muted hover:text-text"
                  }`}
                >
                  Write
                </Link>
                <Link
                  href={`/novel/${novelId}/review`}
                  className={`rounded px-3 py-1 transition ${
                    mode === "review" ? "bg-accent-soft text-accent" : "text-muted hover:text-text"
                  }`}
                >
                  Review
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
            className="flex items-center gap-1.5 rounded border border-border px-2 py-1 text-muted hover:text-text"
          >
            <IconGear className="h-3.5 w-3.5" />
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
