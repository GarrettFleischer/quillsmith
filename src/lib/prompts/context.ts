import {
  CHARACTER_SLIDERS,
  SCENE_SLIDERS,
  formatSliderLine,
  parseSceneSliders,
  parseSliderMap,
} from "@/lib/sliders";

type KnowledgeEntry = {
  type: string;
  name: string;
  aliases?: string | null;
  summary?: string | null;
  slidersJson?: string | null;
};

type OverviewAnswer = {
  questionId: string;
  answer: string;
};

type NovelTree = {
  novel: {
    title: string;
    premise?: string | null;
    genre?: string | null;
    tone?: string | null;
    themes?: string | null;
    stakes?: string | null;
    protagonistFocus?: string | null;
    styleGuideJson?: string | null;
  };
  acts: Array<{
    id?: string;
    title: string;
    brief?: string | null;
    introduces?: string | null;
    accomplishes?: string | null;
    losses?: string | null;
    summary?: string | null;
    chapters: Array<{
      id?: string;
      title: string;
      goal?: string | null;
      summary?: string | null;
      beats: Array<{ content: string }>;
      scenes: Array<{ title?: string | null }>;
    }>;
  }>;
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function answerMap(answers: OverviewAnswer[]): Record<string, string> {
  return Object.fromEntries(answers.map((a) => [a.questionId, a.answer]));
}

/** Last stretch of existing prose so the model can match voice and continue cleanly. */
export function buildVoiceAnchor(currentScene: string, previousScene = "", maxChars = 900): string {
  const source = currentScene.trim() || previousScene.trim();
  if (!source) return "(empty - establish voice from instructions and codex)";
  if (source.length <= maxChars) return source;
  const slice = source.slice(-maxChars);
  const cut = slice.indexOf(" ") >= 0 ? slice.slice(slice.indexOf(" ") + 1) : slice;
  return `...${cut}`;
}

/** Glossary block for prose prompts from the novel knowledge base. */
export function buildCodex(entries: KnowledgeEntry[]): string {
  if (entries.length === 0) {
    return "(no scene-matched lore — use search_knowledge if you need a name from the bible)";
  }
  return entries
    .map((e) => {
      const aliases = e.aliases?.trim() ? ` | aliases: ${e.aliases}` : "";
      const summary = (e.summary ?? "").trim() || "(no summary)";
      const sliders = (e.slidersJson ?? "").trim();
      const sliderNote =
        sliders && sliders !== "{}" ? ` | baseline sliders: ${sliders}` : "";
      return `- [${e.type}] ${e.name}${aliases}: ${summary}${sliderNote}`;
    })
    .join("\n");
}

/** Pack text used to decide which lore belongs in this scene. */
export function sceneMatchText(parts: Array<string | null | undefined>): string {
  return parts.filter((p) => (p ?? "").trim()).join("\n");
}

/** Full novel outline without scene prose bodies (beats + scene titles only). */
export function buildOutlineXml(tree: NovelTree): string {
  const { novel, acts } = tree;
  const actXml = acts
    .map((act, ai) => {
      const chapters = act.chapters
        .map((ch, ci) => {
          const beatLines = ch.beats
            .map(
              (b, bi) =>
                `          <beat n="${bi + 1}">${escapeXml(b.content.trim() || "(empty beat)")}</beat>`,
            )
            .join("\n");
          const sceneLines = ch.scenes
            .map(
              (s, si) =>
                `          <scene number="${si + 1}" title="${escapeXml(s.title || `Scene ${si + 1}`)}" />`,
            )
            .join("\n");
          return `      <chapter title="${escapeXml(ch.title)}" number="${ci + 1}">
        <goal>${escapeXml(ch.goal ?? "")}</goal>
        <beats>
${beatLines || "          (none)"}
        </beats>
        <scenes>
${sceneLines || "          (none)"}
        </scenes>
      </chapter>`;
        })
        .join("\n");

      return `    <act title="${escapeXml(act.title)}" number="${ai + 1}">
      <brief>${escapeXml(act.brief ?? "")}</brief>
      <introduces>${escapeXml(act.introduces ?? "")}</introduces>
      <accomplishes>${escapeXml(act.accomplishes ?? "")}</accomplishes>
      <losses>${escapeXml(act.losses ?? "")}</losses>
${chapters}
    </act>`;
    })
    .join("\n");

  return `<outline>
  <novel title="${escapeXml(novel.title)}" premise="${escapeXml(novel.premise ?? "")}" genre="${escapeXml(novel.genre ?? "")}" tone="${escapeXml(novel.tone ?? "")}">
${actXml}
  </novel>
</outline>`;
}

export function buildSceneInstructions(opts: {
  chapterBeats: { content: string }[];
  userInstruction: string;
  answers: OverviewAnswer[];
  sceneTitle?: string | null;
  hasExistingProse?: boolean;
}): string {
  const answers = answerMap(opts.answers);
  const pov = (answers["novel.pov_tense"] ?? "").trim();
  const genreToneLine = (answers["novel.genre_tone"] ?? "").trim();
  const povAttr = pov
    ? escapeXml(pov.split(/[.;\n]/)[0]?.trim() || pov)
    : "follow established scene voice";

  const beatLines = opts.chapterBeats
    .map((b) => b.content.trim())
    .filter(Boolean)
    .map((line, i) => `        ${i + 1}. ${escapeXml(line)}`)
    .join("\n");

  const instructionExtra = opts.userInstruction.trim()
    ? `\n        Author notes: ${escapeXml(opts.userInstruction.trim())}`
    : "";

  const titleHint = opts.sceneTitle?.trim()
    ? `\n        Scene focus: ${escapeXml(opts.sceneTitle.trim())}`
    : "";

  const continueHint = opts.hasExistingProse
    ? `\n        Continuation rule: Existing prose is already on the page. Do not restart. Skip beats already dramatized; write only what is still missing, in order.`
    : `\n        Opening rule: Establish viewpoint and situation through dramatized action, not synopsis.`;

  return `<instructions>
<pointOfView note="${povAttr}"/>
${pov ? `        POV/tense constraints: ${escapeXml(pov)}\n` : ""}${
    genreToneLine ? `        Genre/tone: ${escapeXml(genreToneLine)}\n` : ""
  }${titleHint}${continueHint}
        Beats (execute in order; stop when these are covered)
${beatLines || "        (no beats listed - follow the author notes only)"}
${instructionExtra}
</instructions>`;
}

export function buildNovelMeta(tree: NovelTree, answers: OverviewAnswer[]): string {
  const map = answerMap(answers);
  const lines = [
    `Title: ${tree.novel.title}`,
    tree.novel.premise && `Premise: ${tree.novel.premise}`,
    map["novel.premise"] && !tree.novel.premise && `Premise: ${map["novel.premise"]}`,
    tree.novel.genre && `Genre: ${tree.novel.genre}`,
    tree.novel.tone && `Tone: ${tree.novel.tone}`,
    tree.novel.themes && `Themes: ${tree.novel.themes}`,
    tree.novel.stakes && `Stakes: ${tree.novel.stakes}`,
    tree.novel.protagonistFocus && `Protagonist: ${tree.novel.protagonistFocus}`,
    map["novel.protagonist"] && `Protagonist notes: ${map["novel.protagonist"]}`,
    map["novel.pov_tense"] && `POV/tense: ${map["novel.pov_tense"]}`,
    map["novel.genre_tone"] && `Genre/tone notes: ${map["novel.genre_tone"]}`,
    map["novel.theme"] && `Thematic questions: ${map["novel.theme"]}`,
  ].filter(Boolean);
  return lines.join("\n");
}

export function buildStorySoFar(tree: NovelTree, currentChapterId: string): string {
  const lines: string[] = [];
  let passed = false;
  for (const act of tree.acts) {
    for (const ch of act.chapters) {
      if (ch.id && ch.id === currentChapterId) {
        passed = true;
        break;
      }
      const summary = (ch.summary ?? "").trim();
      lines.push(
        `- ${act.title} / ${ch.title}: ${summary || "(no chapter summary yet)"}`,
      );
    }
    if (passed) break;
  }
  if (lines.length === 0) return "(this is the first chapter — no prior summaries)";
  return lines.join("\n");
}

export function buildCurrentActOutline(
  tree: NovelTree,
  currentActTitle: string,
): string {
  const act = tree.acts.find((a) => a.title === currentActTitle) ?? tree.acts[0];
  if (!act) return "(no act)";
  const slim: NovelTree = {
    novel: tree.novel,
    acts: [act],
  };
  return buildOutlineXml(slim);
}

export function buildChapterContext(
  summary: string | null | undefined,
  beats: { content: string }[],
): string {
  const beatLines = beats
    .map((b, i) => `${i + 1}. ${b.content.trim()}`)
    .filter((l) => l.length > 3)
    .join("\n");
  const sum = (summary ?? "").trim() || "(no summary yet)";
  return `Chapter summary:\n${sum}\n\nBeats:\n${beatLines || "(none)"}`;
}

export type StyleGuide = {
  approved?: boolean;
  sentenceLength?: string;
  formality?: string;
  humor?: string;
  lean?: string;
  favoredPhrases?: string[];
  bannedPhrases?: string[];
  rules?: string[];
};

export function parseStyleGuide(json?: string | null): StyleGuide | null {
  if (!json?.trim()) return null;
  try {
    return JSON.parse(json) as StyleGuide;
  } catch {
    return null;
  }
}

export function buildStyleGuideBlock(json?: string | null): string {
  const guide = parseStyleGuide(json);
  if (!guide?.approved) return "";
  const lines = ["Author style guide (follow this persona before typing):"];
  if (guide.sentenceLength) lines.push(`Sentence length: ${guide.sentenceLength}`);
  if (guide.formality) lines.push(`Formality: ${guide.formality}`);
  if (guide.humor) lines.push(`Humor: ${guide.humor}`);
  if (guide.lean) lines.push(`Lean: ${guide.lean}`);
  if (guide.favoredPhrases?.length) {
    lines.push(`Favored phrases: ${guide.favoredPhrases.join("; ")}`);
  }
  if (guide.bannedPhrases?.length) {
    lines.push(`Avoid: ${guide.bannedPhrases.join("; ")}`);
  }
  if (guide.rules?.length) {
    lines.push("Rules:");
    for (const r of guide.rules) lines.push(`- ${r}`);
  }
  return lines.join("\n");
}

export function buildSlidersBlock(opts: {
  sceneSlidersJson?: string | null;
  entries: Array<{ id?: string; name: string; type: string; slidersJson?: string | null }>;
}): string {
  const scene = parseSceneSliders(opts.sceneSlidersJson);
  const lines = ["Narrative physics (this scene):"];
  for (const def of SCENE_SLIDERS) {
    const value = def.id === "tension" ? scene.tension : def.id === "spice" ? scene.spice : undefined;
    lines.push(`- ${formatSliderLine(def, value)}`);
  }
  const characters = opts.entries.filter((e) => e.type === "character");
  if (characters.length === 0) {
    lines.push("- Characters: (none matched in this scene)");
    return lines.join("\n");
  }
  lines.push("- Character states:");
  for (const entry of characters) {
    const baseline = parseSliderMap(entry.slidersJson);
    const sceneMap = (entry.id && scene.characters?.[entry.id]) || {};
    const bits: string[] = [];
    for (const def of CHARACTER_SLIDERS) {
      const value = sceneMap[def.id] ?? baseline[def.id];
      bits.push(formatSliderLine(def, value));
    }
    lines.push(`  - ${entry.name}: ${bits.join("; ")}`);
  }
  return lines.join("\n");
}
