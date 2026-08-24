import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { acts, beats, chapters } from "@/db/schema";
import {
  chapterBelongsToNovel,
  getNovelTree,
  getSettings,
  listKnowledge,
} from "@/lib/novels";
import { actLabel, chapterLabel, findChapterPlace } from "@/lib/manuscript";
import { buildCodex } from "@/lib/prompts/context";
import { collectAgentText, runAgentLoop, type ChatMessage } from "@/lib/openrouter";
import { plainFromTipTap } from "@/lib/utils";

export const runtime = "nodejs";

const SYSTEM = `You are drafting one beat of a novel chapter. Write ONLY the prose for the given beat — the concrete scene action that the beat describes — in the author's voice.
- Continue naturally from the prose that precedes this beat; do not repeat it.
- Cover just this beat; do not jump ahead to later beats.
- Return prose only: no headings, no beat labels, no commentary.`;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      novelId: string;
      chapterId: string;
      beatId: string;
      model?: string;
    };
    if (!chapterBelongsToNovel(body.chapterId, body.novelId)) {
      return Response.json({ error: "Chapter not found" }, { status: 404 });
    }
    const tree = getNovelTree(body.novelId);
    if (!tree) return Response.json({ error: "Novel not found" }, { status: 404 });

    const db = getDb();
    const chapter = db.select().from(chapters).where(eq(chapters.id, body.chapterId)).get()!;
    const act = db.select().from(acts).where(eq(acts.id, chapter.actId)).get();
    const beatRows = db
      .select()
      .from(beats)
      .where(eq(beats.chapterId, chapter.id))
      .orderBy(asc(beats.order))
      .all();
    const idx = beatRows.findIndex((b) => b.id === body.beatId);
    if (idx < 0) return Response.json({ error: "Beat not found" }, { status: 404 });
    const target = beatRows[idx];
    if (!target.content.trim()) {
      return Response.json({ error: "Add a beat outline first." }, { status: 400 });
    }

    const place = findChapterPlace(tree.acts, chapter.id);
    const chapterTitle = place ? chapterLabel(place.chapterIndex, place.chapter.title) : chapter.title;
    const actTitle = place ? actLabel(place.actIndex, place.act.title) : act?.title ?? "";
    const precedingProse = beatRows
      .slice(0, idx)
      .map((b) => plainFromTipTap(b.prose || ""))
      .filter((t) => t.trim())
      .join("\n\n");
    const laterBeats = beatRows
      .slice(idx + 1)
      .map((b, i) => `${idx + i + 2}. ${b.content}`)
      .filter((l) => l.trim().length > 3)
      .join("\n");
    const codex = buildCodex(listKnowledge(body.novelId));
    const model = body.model?.trim() || getSettings().defaultModel || "anthropic/claude-sonnet-4";

    const messages: ChatMessage[] = [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: `Novel premise: ${tree.novel.premise || "(none)"}
Tone: ${tree.novel.tone || "(unspecified)"}
${actTitle ? `Act: ${actTitle}` : ""}
Chapter: ${chapterTitle}
Chapter goal: ${chapter.goal || "(none)"}
Chapter summary: ${chapter.summary || "(none)"}

Story bible:
${codex}

Prose so far in this chapter:
${precedingProse || "(this is the opening of the chapter)"}

${laterBeats ? `Beats still to come (do NOT write these yet):\n${laterBeats}\n` : ""}
Write the prose for THIS beat now:
${target.content}`,
      },
    ];

    const text = await collectAgentText(
      runAgentLoop({ model, temperature: 0.7, messages, novelId: body.novelId }),
    );
    return Response.json({ text: text.trim() });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Failed to write beat" },
      { status: 500 },
    );
  }
}
