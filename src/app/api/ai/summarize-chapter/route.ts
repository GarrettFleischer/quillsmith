import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { acts, chapters, scenes } from "@/db/schema";
import { systemPromptForTask } from "@/lib/ai-tasks";
import { actLabel, chapterLabel, findChapterPlace } from "@/lib/manuscript";
import { getNovelTree, upsertAct, upsertChapter } from "@/lib/novels";
import { collectAgentText, runAgentLoop, type ChatMessage } from "@/lib/openrouter";
import { resolveTaskRuntime } from "@/lib/task-runtime";
import { plainFromTipTap } from "@/lib/utils";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      novelId: string;
      chapterId?: string;
      actId?: string;
      model?: string;
    };
    const tree = getNovelTree(body.novelId);
    if (!tree) return Response.json({ error: "Novel not found" }, { status: 404 });
    const db = getDb();

    if (body.actId) {
      const act = db.select().from(acts).where(eq(acts.id, body.actId)).get();
      if (!act || act.novelId !== body.novelId) {
        return Response.json({ error: "Act not found" }, { status: 404 });
      }
      const { model, temperature } = resolveTaskRuntime("summarize_act", body.model);
      const chapterRows = db.select().from(chapters).where(eq(chapters.actId, act.id)).all();
      const actIndex = tree.acts.findIndex((a) => a.id === act.id);
      const messages: ChatMessage[] = [
        { role: "system", content: systemPromptForTask("summarize_act") },
        {
          role: "user",
          content: `Act: ${actLabel(Math.max(actIndex, 0), act.title)}
Brief: ${act.brief}
Introduces: ${act.introduces}
Accomplishes: ${act.accomplishes}
Losses: ${act.losses}
State start: ${act.stateStart}
State end: ${act.stateEnd}

Chapter summaries:
${chapterRows.map((c, i) => `- ${chapterLabel(i, c.title)}: ${c.summary || "(none)"}`).join("\n")}`,
        },
      ];
      const proposed = await collectAgentText(
        runAgentLoop({ model, temperature, messages, novelId: body.novelId }),
      );
      return Response.json({
        scope: "act",
        id: act.id,
        currentSummary: act.summary,
        proposedSummary: proposed,
      });
    }

    const chapterId = body.chapterId;
    if (!chapterId) return Response.json({ error: "chapterId or actId required" }, { status: 400 });
    const chapter = db.select().from(chapters).where(eq(chapters.id, chapterId)).get();
    if (!chapter) return Response.json({ error: "Chapter not found" }, { status: 404 });
    const act = db.select().from(acts).where(eq(acts.id, chapter.actId)).get();
    if (!act || act.novelId !== body.novelId) {
      return Response.json({ error: "Chapter not found" }, { status: 404 });
    }

    const sceneRows = db.select().from(scenes).where(eq(scenes.chapterId, chapter.id)).all();
    const { model, temperature } = resolveTaskRuntime("summarize_chapter", body.model);
    const messages: ChatMessage[] = [
      { role: "system", content: systemPromptForTask("summarize_chapter") },
      {
        role: "user",
        content: `Chapter: ${chapterLabel(findChapterPlace(tree.acts, chapter.id)?.chapterIndex ?? 0, chapter.title)}
Goal: ${chapter.goal}
Current summary: ${chapter.summary || "(none)"}

Beats:
${tree.acts
  .flatMap((a) => a.chapters)
  .find((c) => c.id === chapter.id)
  ?.beats.map((b, i) => `${i + 1}. ${b.content}`)
  .join("\n") || "(none)"}

Prose:
${sceneRows.map((s) => plainFromTipTap(s.content)).join("\n\n") || "(empty)"}`,
      },
    ];
    const proposed = await collectAgentText(
      runAgentLoop({ model, temperature, messages, novelId: body.novelId }),
    );
    return Response.json({
      scope: "chapter",
      id: chapter.id,
      currentSummary: chapter.summary,
      proposedSummary: proposed,
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 },
    );
  }
}

export async function PUT(req: Request) {
  const body = (await req.json()) as {
    novelId: string;
    chapterId?: string;
    actId?: string;
    summary: string;
  };
  const tree = getNovelTree(body.novelId);
  if (!tree) return Response.json({ error: "Novel not found" }, { status: 404 });
  if (body.actId) {
    const act = tree.acts.find((a) => a.id === body.actId);
    if (!act) return Response.json({ error: "Act not found" }, { status: 404 });
    return Response.json(
      upsertAct({
        id: act.id,
        novelId: body.novelId,
        title: act.title,
        summary: body.summary,
      }),
    );
  }
  if (!body.chapterId) {
    return Response.json({ error: "chapterId or actId required" }, { status: 400 });
  }
  for (const act of tree.acts) {
    const ch = act.chapters.find((c) => c.id === body.chapterId);
    if (ch) {
      return Response.json(
        upsertChapter({
          id: ch.id,
          actId: act.id,
          novelId: body.novelId,
          title: ch.title,
          goal: ch.goal ?? "",
          summary: body.summary,
        }),
      );
    }
  }
  return Response.json({ error: "Chapter not found" }, { status: 404 });
}
