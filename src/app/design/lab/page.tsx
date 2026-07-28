"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AppHeader } from "@/components/app-header";

const FAMILIES = [
  {
    id: "ink-ledger",
    name: "Ink Ledger",
    selected: true,
    note: "Chosen — parchment + teal ink, wide rails",
    className: "bg-[#f3efe6] text-[#1a1612] border-[#d4cbb8]",
    accent: "#2f5d50",
  },
  {
    id: "quiet-charcoal",
    name: "Quiet Charcoal",
    selected: false,
    note: "Rejected as primary — too generic dark",
    className: "bg-[#121212] text-[#e8e4dc] border-[#2a2a2a]",
    accent: "#a8a29a",
  },
  {
    id: "paper-craft",
    name: "Paper Craft",
    selected: false,
    note: "Rejected — cream/terracotta cliché risk",
    className: "bg-[#f7f1e8] text-[#3b2f2a] border-[#e6d5c3]",
    accent: "#c45c26",
  },
  {
    id: "dither-mono",
    name: "Dither Mono",
    selected: false,
    note: "Accent only",
    className: "bg-[#f5f5f0] text-black border-black",
    accent: "#000",
  },
  {
    id: "print-tech",
    name: "Print Tech",
    selected: false,
    note: "Metadata rows only",
    className: "bg-[#fafafa] text-[#111] border-[#ccc]",
    accent: "#0b3d91",
  },
];

const LAYOUTS = [
  { id: "A", name: "Wide rail", note: "280 / fluid / 260 — chosen" },
  { id: "B", name: "Narrow chrome", note: "Too cramped for KB" },
  { id: "C", name: "Floating panels", note: "Too dashboard-like" },
];

export default function DesignLabPage() {
  const [density, setDensity] = useState(1);
  const [accent, setAccent] = useState("#2f5d50");
  const shellStyle = useMemo(
    () =>
      ({
        ["--lab-accent" as string]: accent,
        fontSize: `${0.9 + density * 0.1}rem`,
      }) as React.CSSProperties,
    [accent, density],
  );

  return (
    <div className="min-h-full">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 py-10" style={shellStyle}>
        <p className="text-xs uppercase tracking-[0.25em] text-muted">Dev only</p>
        <h1 className="font-display text-4xl">Design lab</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Aesthetic exploration for Quillsmith. Locked direction:{" "}
          <strong className="text-text">Ink Ledger</strong>. See{" "}
          <code className="text-sm">design/inspiration/BRIEF.md</code>.
        </p>

        <section className="mt-10">
          <h2 className="font-serif text-2xl">Five families</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FAMILIES.map((f) => (
              <div
                key={f.id}
                className={`rounded-lg border p-4 ${f.className} ${
                  f.selected ? "ring-2 ring-offset-2" : "opacity-80"
                }`}
                style={{ ["--tw-ring-color" as string]: f.accent }}
              >
                <p className="font-display text-2xl">{f.name}</p>
                <p className="mt-2 text-sm opacity-80">{f.note}</p>
                <div
                  className="mt-4 h-2 rounded"
                  style={{ background: f.accent }}
                />
              </div>
            ))}
          </div>
        </section>

        <section className="mt-12">
          <h2 className="font-serif text-2xl">Layout variants (Ink Ledger)</h2>
          <ul className="mt-4 space-y-2">
            {LAYOUTS.map((l) => (
              <li key={l.id} className="rounded border border-border bg-surface px-3 py-2">
                <span className="font-medium">{l.id}. {l.name}</span>
                <span className="ml-2 text-sm text-muted">{l.note}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-12 rounded border border-border bg-surface p-4">
          <h2 className="font-serif text-2xl">Tweaks</h2>
          <label className="mt-4 block text-sm">
            Density
            <input
              type="range"
              min={0}
              max={2}
              step={0.1}
              value={density}
              onChange={(e) => setDensity(Number(e.target.value))}
              className="mt-2 block w-full"
            />
          </label>
          <label className="mt-4 block text-sm">
            Accent
            <input
              type="color"
              value={accent}
              onChange={(e) => setAccent(e.target.value)}
              className="mt-2 block"
            />
          </label>
          <div
            className="mt-6 grid grid-cols-[160px_1fr_140px] overflow-hidden rounded border border-border"
            style={{ borderColor: "color-mix(in oklab, var(--lab-accent) 40%, #d4cbb8)" }}
          >
            <div className="bg-[#ebe4d6] p-3 text-sm">KB rail</div>
            <div className="bg-[#f3efe6] p-4 font-serif">
              <p className="font-display text-3xl" style={{ color: accent }}>
                Quillsmith
              </p>
              <p className="mt-2">Manuscript column sample with chosen measure.</p>
            </div>
            <div className="bg-[#ebe4d6] p-3 text-sm">Beats</div>
          </div>
        </section>

        <p className="mt-8 text-sm text-muted">
          <Link href="/" className="text-accent hover:underline">
            Back home
          </Link>
        </p>
      </main>
    </div>
  );
}
