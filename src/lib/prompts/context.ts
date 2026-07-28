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
            .map((b) => `          ${escapeXml(b.content.trim() || "(empty beat)")}`)
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
}): string {
  const answers = answerMap(opts.answers);
  const pov = (answers["novel.pov_tense"] ?? "").trim();
  const povAttr = pov
    ? escapeXml(pov.split(/[.;\n]/)[0]?.trim() || pov)
    : "follow established scene voice";

  const beatLines = opts.chapterBeats
    .map((b) => b.content.trim())
    .filter(Boolean)
    .map((line) => `        ${escapeXml(line)}`)
    .join("\n");

  const instructionExtra = opts.userInstruction.trim()
    ? `\n${escapeXml(opts.userInstruction.trim())}`
    : "";

  const titleHint = opts.sceneTitle?.trim()
    ? `\n        Scene focus: ${escapeXml(opts.sceneTitle.trim())}`
    : "";

  return `<instructions>
<pointOfView note="${povAttr}"/>
${pov ? `        POV/tense constraints: ${escapeXml(pov)}\n` : ""}${titleHint}
        Beats
${beatLines || "        (no beats listed - follow the user instruction only)"}
${instructionExtra}
</instructions>`;
}

export function buildNovelMeta(tree: NovelTree, answers: OverviewAnswer[]): string {
  const map = answerMap(answers);
  const lines = [
    `Title: ${tree.novel.title}`,
    tree.novel.premise && `Premise: ${tree.novel.premise}`,
    tree.novel.genre && `Genre: ${tree.novel.genre}`,
    tree.novel.tone && `Tone: ${tree.novel.tone}`,
    tree.novel.themes && `Themes: ${tree.novel.themes}`,
    tree.novel.stakes && `Stakes: ${tree.novel.stakes}`,
    tree.novel.protagonistFocus && `Protagonist: ${tree.novel.protagonistFocus}`,
    map["novel.pov_tense"] && `POV/tense: ${map["novel.pov_tense"]}`,
    map["novel.genre_tone"] && `Genre/tone notes: ${map["novel.genre_tone"]}`,
  ].filter(Boolean);
  return lines.join("\n");
}
