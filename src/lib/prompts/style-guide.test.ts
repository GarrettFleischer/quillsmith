import { describe, expect, test } from "bun:test";
import { compileTemplate } from "@/lib/prompt";
import { EXPAND_TEMPLATE, REWRITE_TEMPLATE } from "@/lib/prompts/templates";
import {
  appendStyleGuide,
  buildStyleGuideBlock,
  coerceStyleGuide,
  formatStyleGuideBlock,
  isActiveStyleGuide,
  mergeStyleGuides,
  parseStyleGuide,
  parseStyleSamples,
  serializeStyleSamples,
  shouldAttachStyleGuide,
  styleSampleStats,
  type StyleGuide,
} from "@/lib/prompts/style-guide";

function words(n: number, seed = "word") {
  return Array.from({ length: n }, (_, i) => `${seed}${i}`).join(" ");
}

describe("style samples", () => {
  test("fills three slots from untyped excerpts", () => {
    const parsed = parseStyleSamples(
      JSON.stringify([
        { excerpt: "action prose" },
        { excerpt: "talk prose" },
        { excerpt: "quiet prose" },
      ]),
    );
    expect(parsed.map((s) => s.kind)).toEqual(["action", "dialogue", "quiet"]);
    expect(parsed.map((s) => s.excerpt)).toEqual(["action prose", "talk prose", "quiet prose"]);
  });

  test("ready requires 80 words in each slot", () => {
    const samples = parseStyleSamples(
      serializeStyleSamples([
        { kind: "action", excerpt: words(80) },
        { kind: "dialogue", excerpt: words(80, "talk") },
        { kind: "quiet", excerpt: words(79, "still") },
      ]),
    );
    const stats = styleSampleStats(samples);
    expect(stats.filled).toBe(3);
    expect(stats.ready).toBe(false);
    samples[2].excerpt = words(80, "still");
    expect(styleSampleStats(samples).ready).toBe(true);
  });
});

describe("style guide parse and format", () => {
  test("treats freeform Codex notes as an approved overlay", () => {
    const guide = parseStyleGuide("Keep the jokes dry. No weather opens.");
    expect(guide?.approved).toBe(true);
    expect(guide?.rules).toEqual(["Keep the jokes dry. No weather opens."]);
  });

  test("unapproved JSON is not injected into prompts", () => {
    const guide: StyleGuide = {
      approved: false,
      dialogue: "Action beats, almost never said.",
    };
    expect(isActiveStyleGuide(guide)).toBe(false);
    expect(buildStyleGuideBlock(JSON.stringify(guide))).toBe("");
  });

  test("formats Story Hacker dimensions as instructions", () => {
    const block = formatStyleGuideBlock({
      approved: true,
      sentenceRhythm: "12-15 words, then a 3-word stop.",
      purpleProse: "Concrete. Imagery only when it raises pressure.",
      dialogue: "Tags are said or cut. Beats do the rest.",
      humor: "Dry, rare, never a rimshot.",
      doThis: ["Drop into the moment; skip room tours."],
      dontDo: ["Do not stack metaphors."],
      exampleAnchor: "He counted. Stopped counting.",
    });
    expect(block).toContain("Author voice");
    expect(block).toContain("Sentence rhythm and variation");
    expect(block).toContain("Purple-prose level");
    expect(block).toContain("Calibration excerpt");
    expect(block).toContain("He counted. Stopped counting.");
  });

  test("merges author voice with a book overlay", () => {
    const merged = mergeStyleGuides(
      { approved: true, dialogue: "Short turns.", rules: ["Prefer said."] },
      { approved: true, dialogue: "Period slang in the tavern.", rules: ["No modern slang."] },
    );
    expect(merged?.dialogue).toContain("This book also");
    expect(merged?.rules).toEqual(["Prefer said.", "No modern slang."]);
  });

  test("coerce maps legacy fields", () => {
    const guide = coerceStyleGuide({
      sentenceLength: "short",
      formality: "casual",
      bannedPhrases: ["delve"],
    });
    expect(guide.sentenceRhythm).toBe("short");
    expect(guide.vocabulary).toBe("casual");
    expect(guide.dontDo).toEqual(["delve"]);
    expect(guide.approved).toBe(false);
  });
});

describe("prompt attachment", () => {
  test("appendStyleGuide is a no-op on empty blocks", () => {
    expect(appendStyleGuide("system", "  ")).toBe("system");
    expect(appendStyleGuide("system", "voice rules")).toBe("system\n\nvoice rules");
  });

  test("writing tasks attach; analysis tasks do not", () => {
    expect(shouldAttachStyleGuide("prose_expand")).toBe(true);
    expect(shouldAttachStyleGuide("prose_rewrite")).toBe(true);
    expect(shouldAttachStyleGuide("layer_dialogue")).toBe(true);
    expect(shouldAttachStyleGuide("chapter_chat")).toBe(true);
    expect(shouldAttachStyleGuide("check_apply")).toBe(true);
    expect(shouldAttachStyleGuide("scrub_brochure_language", { scrubMode: "rewrite" })).toBe(true);
    expect(shouldAttachStyleGuide("analyze_style")).toBe(false);
    expect(shouldAttachStyleGuide("scrub_brochure_language", { scrubMode: "identify" })).toBe(false);
    expect(shouldAttachStyleGuide("check_adverbs", { checkMode: "plan" })).toBe(false);
  });

  test("expand and rewrite templates include the styleGuide slot", () => {
    const filled = compileTemplate(EXPAND_TEMPLATE, { styleGuide: "VOICE_BLOCK" });
    expect(filled).toContain("VOICE_BLOCK");
    expect(compileTemplate(REWRITE_TEMPLATE, { styleGuide: "VOICE_BLOCK" })).toContain("VOICE_BLOCK");
  });
});
