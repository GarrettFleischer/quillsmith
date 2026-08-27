/** Three sample kinds from Story Hacker / Nerdy Novelist voice extraction. */
export const STYLE_SAMPLE_SLOTS = [
  {
    kind: "action",
    title: "Action / pressure",
    hint: "A finished scene with motion, danger, or urgency. How you write when the viewpoint character is under stress.",
  },
  {
    kind: "dialogue",
    title: "Dialogue-heavy",
    hint: "An exchange where speech carries the scene. Include tags, action beats, interruptions, and what people refuse to say.",
  },
  {
    kind: "quiet",
    title: "Quiet / interior",
    hint: "A slower moment: thought, atmosphere, or feeling without a fight. How you handle description and inner life.",
  },
] as const;

export type StyleSampleKind = (typeof STYLE_SAMPLE_SLOTS)[number]["kind"];

export type StyleSample = {
  kind: StyleSampleKind;
  excerpt: string;
  note?: string;
};

export type StyleGuide = {
  approved?: boolean;
  generatedAt?: string;
  sentenceRhythm?: string;
  vocabulary?: string;
  purpleProse?: string;
  povDistance?: string;
  dialogue?: string;
  humor?: string;
  description?: string;
  pacing?: string;
  emotionalRegister?: string;
  signatureQuirks?: string[];
  doThis?: string[];
  dontDo?: string[];
  rules?: string[];
  exampleAnchor?: string;
  /** Legacy fields from the earlier JSON shape. */
  sentenceLength?: string;
  formality?: string;
  lean?: string;
  favoredPhrases?: string[];
  bannedPhrases?: string[];
};

export const MIN_SAMPLE_WORDS = 80;
export const IDEAL_SAMPLE_WORDS = 400;
export const IDEAL_TOTAL_WORDS = 2000;

export function countStyleWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function emptyStyleSamples(): StyleSample[] {
  return STYLE_SAMPLE_SLOTS.map((slot) => ({
    kind: slot.kind,
    excerpt: "",
    note: slot.title,
  }));
}

export function parseStyleSamples(raw?: string | null): StyleSample[] {
  const empty = emptyStyleSamples();
  if (!raw?.trim()) return empty;
  try {
    const parsed = JSON.parse(raw) as unknown;
    const list = Array.isArray(parsed) ? parsed : [];
    const unused = [...list];
    return empty.map((slot) => {
      const byKind = unused.findIndex((item) => isSample(item) && item.kind === slot.kind);
      const index = byKind >= 0 ? byKind : unused.findIndex((item) => isSample(item) && !item.kind);
      if (index < 0) return slot;
      const match = unused.splice(index, 1)[0];
      if (!isSample(match)) return slot;
      return {
        kind: slot.kind,
        excerpt: String(match.excerpt ?? ""),
        note: String(match.note ?? slot.note ?? ""),
      };
    });
  } catch {
    return empty;
  }
}

function isSample(value: unknown): value is Partial<StyleSample> & { excerpt?: unknown } {
  return Boolean(value) && typeof value === "object";
}

export function serializeStyleSamples(samples: StyleSample[]): string {
  return JSON.stringify(
    STYLE_SAMPLE_SLOTS.map((slot) => {
      const match = samples.find((s) => s.kind === slot.kind);
      return {
        kind: slot.kind,
        excerpt: match?.excerpt ?? "",
        note: match?.note || slot.title,
      };
    }),
  );
}

export function filledStyleSamples(samples: StyleSample[]): StyleSample[] {
  return samples.filter((s) => countStyleWords(s.excerpt) > 0);
}

export function styleSampleStats(samples: StyleSample[]): {
  filled: number;
  totalWords: number;
  thin: StyleSampleKind[];
  ready: boolean;
} {
  const filledList = filledStyleSamples(samples);
  const thin = samples
    .filter((s) => countStyleWords(s.excerpt) > 0 && countStyleWords(s.excerpt) < MIN_SAMPLE_WORDS)
    .map((s) => s.kind);
  return {
    filled: filledList.length,
    totalWords: samples.reduce((n, s) => n + countStyleWords(s.excerpt), 0),
    thin,
    ready: STYLE_SAMPLE_SLOTS.every((slot) => {
      const sample = samples.find((s) => s.kind === slot.kind);
      return countStyleWords(sample?.excerpt ?? "") >= MIN_SAMPLE_WORDS;
    }),
  };
}

function asString(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  return undefined;
}

function asStringList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    if (typeof value === "string" && value.trim()) {
      return value
        .split(/\n+/)
        .map((line) => line.replace(/^[-*]\s+/, "").trim())
        .filter(Boolean);
    }
    return undefined;
  }
  const items = value.map((item) => String(item).trim()).filter(Boolean);
  return items.length ? items : undefined;
}

export function coerceStyleGuide(raw: unknown): StyleGuide {
  if (!raw || typeof raw !== "object") return { approved: false, rules: [] };
  const o = raw as Record<string, unknown>;
  return {
    approved: o.approved === true,
    generatedAt: asString(o.generatedAt),
    sentenceRhythm: asString(o.sentenceRhythm) ?? asString(o.sentenceLength),
    vocabulary: asString(o.vocabulary) ?? asString(o.formality),
    purpleProse: asString(o.purpleProse),
    povDistance: asString(o.povDistance),
    dialogue: asString(o.dialogue),
    humor: asString(o.humor),
    description: asString(o.description),
    pacing: asString(o.pacing) ?? asString(o.lean),
    emotionalRegister: asString(o.emotionalRegister),
    signatureQuirks: asStringList(o.signatureQuirks),
    doThis: asStringList(o.doThis),
    dontDo: asStringList(o.dontDo) ?? asStringList(o.bannedPhrases),
    rules: asStringList(o.rules),
    exampleAnchor: asString(o.exampleAnchor),
    sentenceLength: asString(o.sentenceLength),
    formality: asString(o.formality),
    lean: asString(o.lean),
    favoredPhrases: asStringList(o.favoredPhrases),
    bannedPhrases: asStringList(o.bannedPhrases),
  };
}

export function parseStyleGuide(raw?: string | null): StyleGuide | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed === "string") {
      return parsed.trim() ? { approved: true, rules: [parsed.trim()] } : null;
    }
    if (parsed && typeof parsed === "object") {
      return coerceStyleGuide(parsed);
    }
  } catch {
    return { approved: true, rules: [raw.trim()] };
  }
  return null;
}

export function serializeStyleGuide(guide: StyleGuide): string {
  return JSON.stringify(guide);
}

function hasGuideContent(guide: StyleGuide): boolean {
  const strings = [
    guide.sentenceRhythm,
    guide.vocabulary,
    guide.purpleProse,
    guide.povDistance,
    guide.dialogue,
    guide.humor,
    guide.description,
    guide.pacing,
    guide.emotionalRegister,
    guide.exampleAnchor,
    guide.sentenceLength,
    guide.formality,
    guide.lean,
  ];
  if (strings.some((value) => Boolean(value?.trim()))) return true;
  const lists = [
    guide.signatureQuirks,
    guide.doThis,
    guide.dontDo,
    guide.rules,
    guide.favoredPhrases,
    guide.bannedPhrases,
  ];
  return lists.some((list) => Boolean(list?.length));
}

export function emptyStyleGuide(): StyleGuide {
  return { approved: false };
}

export function hasStyleGuideContent(guide: StyleGuide | null | undefined): boolean {
  if (!guide) return false;
  return hasGuideContent(guide);
}

export function isActiveStyleGuide(guide: StyleGuide | null | undefined): guide is StyleGuide {
  if (!guide) return false;
  if (guide.approved === false) return false;
  return hasGuideContent(guide);
}

function joinNotes(a?: string, b?: string): string | undefined {
  const left = a?.trim();
  const right = b?.trim();
  if (left && right && left !== right) return `${left}\nThis book also: ${right}`;
  return left || right || undefined;
}

function joinLists(a?: string[], b?: string[]): string[] | undefined {
  const items = [...(a ?? []), ...(b ?? [])].map((item) => item.trim()).filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out.length ? out : undefined;
}

export function mergeStyleGuides(
  author: StyleGuide | null | undefined,
  book: StyleGuide | null | undefined,
): StyleGuide | null {
  const a = isActiveStyleGuide(author) ? author : null;
  const b = isActiveStyleGuide(book) ? book : null;
  if (!a && !b) return null;
  if (a && !b) return { ...a, approved: true };
  if (!a && b) return { ...b, approved: true };
  return {
    approved: true,
    generatedAt: a!.generatedAt ?? b!.generatedAt,
    sentenceRhythm: joinNotes(a!.sentenceRhythm ?? a!.sentenceLength, b!.sentenceRhythm ?? b!.sentenceLength),
    vocabulary: joinNotes(a!.vocabulary ?? a!.formality, b!.vocabulary ?? b!.formality),
    purpleProse: joinNotes(a!.purpleProse, b!.purpleProse),
    povDistance: joinNotes(a!.povDistance, b!.povDistance),
    dialogue: joinNotes(a!.dialogue, b!.dialogue),
    humor: joinNotes(a!.humor, b!.humor),
    description: joinNotes(a!.description, b!.description),
    pacing: joinNotes(a!.pacing ?? a!.lean, b!.pacing ?? b!.lean),
    emotionalRegister: joinNotes(a!.emotionalRegister, b!.emotionalRegister),
    signatureQuirks: joinLists(a!.signatureQuirks, b!.signatureQuirks),
    doThis: joinLists(a!.doThis, b!.doThis),
    dontDo: joinLists(a!.dontDo ?? a!.bannedPhrases, b!.dontDo ?? b!.bannedPhrases),
    rules: joinLists(a!.rules, b!.rules),
    exampleAnchor: a!.exampleAnchor?.trim() || b!.exampleAnchor?.trim(),
    favoredPhrases: joinLists(a!.favoredPhrases, b!.favoredPhrases),
    bannedPhrases: joinLists(a!.bannedPhrases, b!.bannedPhrases),
  };
}

function pushSection(lines: string[], title: string, body?: string) {
  const text = body?.trim();
  if (!text) return;
  lines.push(`${title}: ${text}`);
}

function pushList(lines: string[], title: string, items?: string[]) {
  if (!items?.length) return;
  lines.push(`${title}:`);
  for (const item of items) lines.push(`- ${item}`);
}

export function formatStyleGuideBlock(guide: StyleGuide): string {
  const lines = [
    "Author voice (follow this before typing. These are instructions, not suggestions. Do not default to generic literary AI prose.):",
  ];
  pushSection(lines, "Sentence rhythm and variation", guide.sentenceRhythm ?? guide.sentenceLength);
  pushSection(lines, "Vocabulary", guide.vocabulary ?? guide.formality);
  pushSection(lines, "Purple-prose level", guide.purpleProse);
  pushSection(lines, "POV / narrative distance", guide.povDistance);
  pushSection(lines, "Dialogue", guide.dialogue);
  pushSection(lines, "Humor", guide.humor);
  pushSection(lines, "Description", guide.description);
  pushSection(lines, "Pacing and paragraphing", guide.pacing ?? guide.lean);
  pushSection(lines, "Emotional register", guide.emotionalRegister);
  pushList(lines, "Signature quirks", guide.signatureQuirks);
  if (guide.favoredPhrases?.length) {
    lines.push(`Favored phrases: ${guide.favoredPhrases.join("; ")}`);
  }
  pushList(lines, "Do this", guide.doThis);
  pushList(lines, "Do not", guide.dontDo ?? guide.bannedPhrases);
  pushList(lines, "Rules", guide.rules);
  const anchor = guide.exampleAnchor?.trim();
  if (anchor) {
    lines.push("Calibration excerpt (match this texture; do not copy its plot):");
    lines.push(anchor);
  }
  return lines.join("\n");
}

export function buildStyleGuideBlock(json?: string | null): string {
  const guide = parseStyleGuide(json);
  if (!isActiveStyleGuide(guide)) return "";
  return formatStyleGuideBlock(guide);
}

export function appendStyleGuide(system: string, styleBlock: string): string {
  const block = styleBlock.trim();
  if (!block) return system;
  if (system.includes(block)) return system;
  return `${system}\n\n${block}`;
}

export function shouldAttachStyleGuide(
  taskId: string,
  opts?: { scrubMode?: string; checkMode?: string },
): boolean {
  if (taskId === "prose_expand" || taskId === "prose_rewrite") return true;
  if (taskId === "chapter_chat") return true;
  if (taskId.startsWith("layer_")) return true;
  if (taskId === "check_apply" || opts?.checkMode === "apply") return true;
  if (taskId.startsWith("scrub_") && opts?.scrubMode === "rewrite") return true;
  return false;
}

export function formatSamplesForAnalysis(samples: StyleSample[]): string {
  return STYLE_SAMPLE_SLOTS.map((slot, index) => {
    const sample = samples.find((s) => s.kind === slot.kind);
    const excerpt = sample?.excerpt.trim() || "(empty)";
    const note = sample?.note?.trim();
    return `Sample ${index + 1} — ${slot.title}${note && note !== slot.title ? ` (${note})` : ""}\n${excerpt}`;
  }).join("\n\n");
}
