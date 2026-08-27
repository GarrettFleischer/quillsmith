"use client";

import { useMemo, useState } from "react";
import {
  countStyleWords,
  emptyStyleGuide,
  hasStyleGuideContent,
  IDEAL_SAMPLE_WORDS,
  IDEAL_TOTAL_WORDS,
  MIN_SAMPLE_WORDS,
  STYLE_SAMPLE_SLOTS,
  styleSampleStats,
  type StyleGuide,
  type StyleSample,
} from "@/lib/prompts/style-guide";

const GUIDE_FIELDS = [
  ["sentenceRhythm", "Sentence rhythm and variation"],
  ["vocabulary", "Vocabulary"],
  ["purpleProse", "Purple-prose level"],
  ["povDistance", "POV / narrative distance"],
  ["dialogue", "Dialogue"],
  ["humor", "Humor"],
  ["description", "Description"],
  ["pacing", "Pacing and paragraphing"],
  ["emotionalRegister", "Emotional register"],
] as const;

const LIST_FIELDS = [
  ["signatureQuirks", "Signature quirks"],
  ["doThis", "Do this"],
  ["dontDo", "Do not"],
  ["rules", "Extra rules"],
] as const;

function listToText(list?: string[]) {
  return (list ?? []).join("\n");
}

function textToList(text: string) {
  return text
    .split("\n")
    .map((line) => line.replace(/^[-*]\s+/, "").trim())
    .filter(Boolean);
}

export function AuthorVoiceSettings({
  samples,
  onSamplesChange,
  guide,
  onGuideChange,
}: {
  samples: StyleSample[];
  onSamplesChange: (samples: StyleSample[]) => void;
  guide: StyleGuide;
  onGuideChange: (guide: StyleGuide) => void;
}) {
  const [busy, setBusy] = useState<"samples" | "extract" | "guide" | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const stats = useMemo(() => styleSampleStats(samples), [samples]);
  const showGuide = hasStyleGuideContent(guide);

  function updateSample(kind: StyleSample["kind"], excerpt: string) {
    onSamplesChange(samples.map((s) => (s.kind === kind ? { ...s, excerpt } : s)));
  }

  async function saveSamples() {
    setBusy("samples");
    setError("");
    try {
      const res = await fetch("/api/ai/analyze-style", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "author", styleSamples: samples }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save samples");
      setStatus("Samples saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save samples");
    } finally {
      setBusy(null);
    }
  }

  async function extractGuide() {
    setBusy("extract");
    setError("");
    setStatus("");
    try {
      const saveRes = await fetch("/api/ai/analyze-style", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "author", styleSamples: samples }),
      });
      if (!saveRes.ok) {
        const data = await saveRes.json();
        throw new Error(data.error || "Could not save samples");
      }
      const res = await fetch("/api/ai/analyze-style", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ samples }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Extract failed");
      onGuideChange({ ...(data.proposed as StyleGuide), approved: false });
      setStatus("Guide drafted. Edit it, then save and enable it for writing prompts.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Extract failed");
    } finally {
      setBusy(null);
    }
  }

  async function saveGuide() {
    setBusy("guide");
    setError("");
    try {
      const res = await fetch("/api/ai/analyze-style", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: "author",
          styleSamples: samples,
          styleGuide: guide,
          approved: guide.approved === true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save guide");
      onGuideChange((data.styleGuide as StyleGuide) ?? guide);
      setStatus(
        guide.approved
          ? "Voice guide enabled. Expand, Rewrite, Layer, checks, and chapter chat will use it."
          : "Voice guide saved. Enable it to include it in writing prompts.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save guide");
    } finally {
      setBusy(null);
    }
  }

  async function clearGuide() {
    setBusy("guide");
    setError("");
    try {
      const res = await fetch("/api/ai/analyze-style", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: "author",
          styleGuide: emptyStyleGuide(),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Could not clear guide");
      }
      onGuideChange(emptyStyleGuide());
      setStatus("Voice guide cleared");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not clear guide");
    } finally {
      setBusy(null);
    }
  }

  const extractDisabled = busy !== null || !stats.ready;

  return (
    <section className="mt-8 rounded border border-border bg-surface p-4">
      <h2 className="font-serif text-xl">Author voice</h2>
      <p className="mt-2 max-w-prose text-sm text-muted">
        Three finished fiction samples, different registers: action, talk, and a quiet moment.
        Quillsmith extracts a fingerprint (sentence variation, dialogue, humor, purple-prose
        level, and the rest) and turns it into instructions for every writing prompt.
      </p>

      <p className="mt-3 text-sm">
        {stats.totalWords.toLocaleString()} words across {stats.filled} of 3 samples.
        {stats.totalWords > 0 && stats.totalWords < IDEAL_TOTAL_WORDS ? (
          <span className="text-muted">
            {" "}
            Aim for about {IDEAL_SAMPLE_WORDS}+ words each ({IDEAL_TOTAL_WORDS.toLocaleString()}{" "}
            total is ideal).
          </span>
        ) : null}
      </p>

      <div className="mt-4 space-y-5">
        {STYLE_SAMPLE_SLOTS.map((slot) => {
          const sample = samples.find((s) => s.kind === slot.kind) ?? {
            kind: slot.kind,
            excerpt: "",
            note: slot.title,
          };
          const words = countStyleWords(sample.excerpt);
          const thin = words > 0 && words < MIN_SAMPLE_WORDS;
          return (
            <label key={slot.kind} className="block text-sm">
              <span className="flex items-baseline justify-between gap-3">
                <span className="font-medium">{slot.title}</span>
                <span className={thin ? "text-danger" : "text-xs text-muted"}>
                  {words} {words === 1 ? "word" : "words"}
                  {thin ? ` (need ${MIN_SAMPLE_WORDS})` : ""}
                </span>
              </span>
              <span className="mt-1 block text-xs text-muted">{slot.hint}</span>
              <textarea
                className="mt-2 w-full rounded border border-border bg-bg px-3 py-2 font-serif text-sm leading-relaxed"
                rows={8}
                value={sample.excerpt}
                onChange={(e) => updateSample(slot.kind, e.target.value)}
                placeholder="Paste finished story prose, not an outline."
              />
            </label>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy !== null}
          className="cursor-pointer rounded border border-border px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => void saveSamples()}
        >
          {busy === "samples" ? "Saving…" : "Save samples"}
        </button>
        <button
          type="button"
          disabled={extractDisabled}
          className="cursor-pointer rounded bg-accent px-3 py-1.5 text-sm text-bg disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => void extractGuide()}
        >
          {busy === "extract" ? "Extracting…" : "Extract style guide"}
        </button>
      </div>
      {!stats.ready ? (
        <p className="mt-2 text-xs text-muted">
          Fill all three samples with at least {MIN_SAMPLE_WORDS} words each to extract.
        </p>
      ) : null}

      {showGuide ? (
        <div className="mt-8 border-t border-border pt-5">
          <h3 className="font-serif text-lg">Voice guide</h3>
          <p className="mt-1 text-sm text-muted">
            Edit until it sounds like you. Enable it only when you would follow these rules
            yourself.
          </p>
          <div className="mt-4 space-y-3">
            {GUIDE_FIELDS.map(([key, label]) => (
              <label key={key} className="block text-sm">
                {label}
                <textarea
                  className="mt-1 w-full rounded border border-border bg-bg px-3 py-2 text-sm"
                  rows={3}
                  value={guide[key] ?? ""}
                  onChange={(e) => onGuideChange({ ...guide, [key]: e.target.value })}
                />
              </label>
            ))}
            {LIST_FIELDS.map(([key, label]) => (
              <label key={key} className="block text-sm">
                {label}
                <span className="block text-xs text-muted">One item per line.</span>
                <textarea
                  className="mt-1 w-full rounded border border-border bg-bg px-3 py-2 text-sm"
                  rows={4}
                  value={listToText(guide[key])}
                  onChange={(e) => onGuideChange({ ...guide, [key]: textToList(e.target.value) })}
                />
              </label>
            ))}
            <label className="block text-sm">
              Calibration excerpt
              <span className="block text-xs text-muted">
                150-300 words from your samples. Models match this texture; they should not copy
                the plot.
              </span>
              <textarea
                className="mt-1 w-full rounded border border-border bg-bg px-3 py-2 font-serif text-sm leading-relaxed"
                rows={6}
                value={guide.exampleAnchor ?? ""}
                onChange={(e) => onGuideChange({ ...guide, exampleAnchor: e.target.value })}
              />
            </label>
          </div>
          <label className="mt-4 flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={guide.approved === true}
              onChange={(e) => onGuideChange({ ...guide, approved: e.target.checked })}
            />
            <span>Include this guide in all writing prompts (Expand, Rewrite, Layer, checks, chapter chat)</span>
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy !== null}
              className="cursor-pointer rounded bg-accent px-3 py-1.5 text-sm text-bg disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => void saveGuide()}
            >
              {busy === "guide" ? "Saving…" : "Save guide"}
            </button>
            <button
              type="button"
              disabled={busy !== null}
              className="cursor-pointer rounded border border-border px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => void clearGuide()}
            >
              Clear guide
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted">
          After extraction, the guide appears here so you can edit it before it touches a draft.
        </p>
      )}

      <div aria-live="polite" className="mt-3 min-h-[1.25rem] text-sm">
        {error ? <p className="text-danger">{error}</p> : null}
        {!error && status ? <p className="text-accent">{status}</p> : null}
      </div>
    </section>
  );
}
