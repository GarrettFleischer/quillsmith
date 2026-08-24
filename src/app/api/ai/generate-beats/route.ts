import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { acts, chapters } from "@/db/schema";
import {
  addOrFillBeats,
  chapterBelongsToNovel,
  getNovelTree,
  getSettings,
  listKnowledge,
} from "@/lib/novels";
import { buildCodex } from "@/lib/prompts/context";
import {
  collectAgentText,
  extractJsonObject,
  runAgentLoop,
  type ChatMessage,
} from "@/lib/openrouter";
import { chapterLabel, findChapterPlace } from "@/lib/manuscript";

export const runtime = "nodejs";

const GENERATE_BEATS_SYSTEM = `You are a meticulous story-structure editor working with a novelist.
Given a chapter's summary (plus any goal, premise, and story-bible names), break it into a short, ordered list of concrete beats.

A beat is a single causal story MOVE — a decision, action, reversal, discovery, or shift in the relationship/stakes — not a theme, mood, or a restatement of the summary.

Rules:
- Produce 3–6 beats, ordered so each clearly leads to the next (cause and effect).
- One sentence each, present tense, concrete and specific to THIS chapter (use the real character/place names when given).
- No prose, no numbering, no commentary, no preamble.
- Do not invent a different chapter; stay inside the given summary and goal.

Return ONLY minified JSON in exactly this shape:
{"beats":["first beat","second beat","third beat"]}`;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      novelId: string;
      chapterId: string;
      model?: string;
    };

    if (!body.novelId || !body.chapterId || !chapterBelongsToNovel(body.chapterId, body.novelId)) {
      return Response.json({ error: "Chapter not found" }, { status: 404 });
    }

    const tree = getNovelTree(body.novelId);
    if (!tree) return Response.json({ error: "Novel not found" }, { status: 404 });

    const db = getDb();
    const chapter = db.select().from(chapters).where(eq(chapters.id, body.chapterId)).get()!;
    const act = db.select().from(acts).where(eq(acts.id, chapter.actId)).get();

    if (!chapter.summary?.trim()) {
      return Response.json(
        { error: "Add a chapter summary first — beats are generated from it." },
        { status: 400 },
      );
    }

    const place = findChapterPlace(tree.acts, chapter.id);
    const chapterTitle = place
      ? chapterLabel(place.chapterIndex, place.chapter.title)
      : chapter.title;
    const codex = buildCodex(listKnowledge(body.novelId));

    const model =
      body.model?.trim() || getSettings().defaultModel || "anthropic/claude-sonnet-4";

    const messages: ChatMessage[] = [
      { role: "system", content: GENERATE_BEATS_SYSTEM },
      {
        role: "user",
        content: `Novel premise: ${tree.novel.premise || "(none)"}
${act ? `Act summary: ${act.summary || act.brief || "(none)"}` : ""}
Chapter: ${chapterTitle}
Chapter goal: ${chapter.goal || "(none)"}

Chapter summary:
${chapter.summary}

Story bible (names you may reference):
${codex || "(none)"}`,
      },
    ];

    const raw = await collectAgentText(
      runAgentLoop({
        model,
        temperature: 0.4,
        messages,
        novelId: body.novelId,
        reasoningEnabled: false,
        maxTokens: 700,
      }),
    );

    let beatLines: string[] = [];
    try {
      const parsed = extractJsonObject(raw) as { beats?: unknown };
      if (Array.isArray(parsed.beats)) {
        beatLines = parsed.beats.map((b) => String(b).trim()).filter(Boolean);
      }
    } catch {
      // Fallback: treat the response as a newline / bullet list.
      beatLines = raw
        .split("\n")
        .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim())
        .filter(Boolean);
    }

    if (beatLines.length === 0) {
      return Response.json(
        { error: "The model did not return usable beats. Try again." },
        { status: 502 },
      );
    }

    const beats = addOrFillBeats(body.chapterId, body.novelId, beatLines);
    return Response.json({ beats });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Failed to generate beats" },
      { status: 500 },
    );
  }
}
