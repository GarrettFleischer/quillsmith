type KnowledgeEntry = {
  type: string;
  name: string;
  aliases?: string | null;
  summary?: string | null;
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
  };
  acts: Array<{
    title: string;
    brief?: string | null;
    introduces?: string | null;
    accomplishes?: string | null;
    losses?: string | null;
    chapters: Array<{
      title: string;
      goal?: string | null;
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
  if (entries.length === 0) return "(empty)";
  return entries
    .map((e) => {
      const aliases = e.aliases?.trim() ? ` | aliases: ${e.aliases}` : "";
      const summary = (e.summary ?? "").trim() || "(no summary)";
      return `- [${e.type}] ${e.name}${aliases}: ${summary}`;
    })
    .join("\n");
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
