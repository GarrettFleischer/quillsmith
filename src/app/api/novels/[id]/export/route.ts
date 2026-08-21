import { withTransaction } from "@/db";
import {
  clearKnowledge,
  clearOverviewAnswers,
  createScene,
  deleteAct,
  getNovelTree,
  listKnowledge,
  listOverviewAnswers,
  saveSceneContent,
  setOverviewAnswer,
  updateNovelOverview,
  upsertAct,
  upsertBeat,
  upsertChapter,
  upsertKnowledge,
} from "@/lib/novels";
import { plainFromTipTap } from "@/lib/utils";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format") || "json";
  const includeRevisions = searchParams.get("revisions") === "1";
  const tree = getNovelTree(id);
  if (!tree) return Response.json({ error: "Not found" }, { status: 404 });

  const knowledge = listKnowledge(id);
  const answers = listOverviewAnswers(id);

  if (format === "markdown") {
    const lines: string[] = [`# ${tree.novel.title}`, ""];
    if (tree.novel.premise) {
      lines.push("## Premise", "", tree.novel.premise, "");
    }
    for (const act of tree.acts) {
      lines.push(`## ${act.title}`, "");
      if (act.brief) lines.push(act.brief, "");
        for (const chapter of act.chapters) {
          lines.push(`### ${chapter.title}`, "");
          if (chapter.goal) lines.push(`*Goal:* ${chapter.goal}`, "");
          if (chapter.summary) lines.push(chapter.summary, "");
          if (chapter.beats.length) {
            lines.push("**Beats**", "");
            chapter.beats.forEach((b, i) => lines.push(`${i + 1}. ${b.content}`));
            lines.push("");
          }
          const prose = chapter.prose ?? chapter.scenes[0];
          if (prose) {
            lines.push(plainFromTipTap(prose.content), "");
          }
        }
    }
    return new Response(lines.join("\n"), {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${tree.novel.title}.md"`,
      },
    });
  }

  const payload = {
    novel: tree.novel,
    acts: tree.acts.map((a) => ({
      ...a,
      chapters: a.chapters.map((c) => ({
        ...c,
        scenes: c.scenes.map((s) => {
          const { ...rest } = s;
          return includeRevisions ? rest : rest;
        }),
      })),
    })),
    knowledge,
    answers,
  };

  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${tree.novel.title}.json"`,
    },
  });
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const data = (await req.json()) as {
    novel?: Record<string, unknown>;
    acts?: Array<Record<string, unknown>>;
    knowledge?: Array<Record<string, unknown>>;
    answers?: Array<Record<string, unknown>>;
  };

  const tree = getNovelTree(id);
  if (!tree) return Response.json({ error: "Not found" }, { status: 404 });

  try {
    withTransaction(() => {
      for (const act of [...tree.acts].reverse()) {
        deleteAct(act.id, id);
      }

      clearKnowledge(id);
      clearOverviewAnswers(id);

      if (data.novel) {
        updateNovelOverview(id, {
          title: String(data.novel.title ?? tree.novel.title),
          premise: String(data.novel.premise ?? ""),
          genre: String(data.novel.genre ?? ""),
          tone: String(data.novel.tone ?? ""),
          themes: String(data.novel.themes ?? ""),
          stakes: String(data.novel.stakes ?? ""),
          protagonistFocus: String(data.novel.protagonistFocus ?? ""),
          endingIntention: String(data.novel.endingIntention ?? ""),
          notes: String(data.novel.notes ?? ""),
        });
      }

      for (const act of data.acts ?? []) {
        const createdAct = upsertAct({
          novelId: id,
          title: String(act.title ?? "Act"),
          brief: String(act.brief ?? ""),
          introduces: String(act.introduces ?? ""),
          accomplishes: String(act.accomplishes ?? ""),
          losses: String(act.losses ?? ""),
          stateStart: String(act.stateStart ?? ""),
          stateEnd: String(act.stateEnd ?? ""),
          order: Number(act.order ?? 0),
        });
        for (const chapter of (act.chapters as Array<Record<string, unknown>>) ?? []) {
          const createdChapter = upsertChapter({
            novelId: id,
            actId: createdAct.id,
            title: String(chapter.title ?? "Chapter"),
            goal: String(chapter.goal ?? ""),
            order: Number(chapter.order ?? 0),
          });
          const importedScenes = (chapter.scenes as Array<Record<string, unknown>>) ?? [];
          if (importedScenes.length) {
            const refreshed = getNovelTree(id)!;
            const ch = refreshed.acts
              .flatMap((a) => a.chapters)
              .find((c) => c.id === createdChapter.id);
            const defaultScene = ch?.scenes[0];
            if (defaultScene && importedScenes[0]) {
              saveSceneContent(
                defaultScene.id,
                id,
                String(importedScenes[0].content ?? defaultScene.content),
                "manual",
                "Import",
              );
            }
            for (let i = 1; i < importedScenes.length; i++) {
              const s = createScene(
                createdChapter.id,
                id,
                String(importedScenes[i].title ?? `Scene ${i + 1}`),
              );
              saveSceneContent(
                s.id,
                id,
                String(importedScenes[i].content ?? s.content),
                "manual",
                "Import",
              );
            }
          }
          for (const beat of (chapter.beats as Array<Record<string, unknown>>) ?? []) {
            upsertBeat({
              novelId: id,
              chapterId: createdChapter.id,
              content: String(beat.content ?? ""),
              order: Number(beat.order ?? 0),
            });
          }
        }
      }

      for (const k of data.knowledge ?? []) {
        upsertKnowledge({
          novelId: id,
          type: String(k.type ?? "other"),
          name: String(k.name ?? "Unnamed"),
          aliases: String(k.aliases ?? ""),
          summary: String(k.summary ?? ""),
          notes: String(k.notes ?? ""),
        });
      }

      for (const a of data.answers ?? []) {
        setOverviewAnswer(id, String(a.questionId), String(a.answer ?? ""));
      }
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Import failed" },
      { status: 500 },
    );
  }

  return Response.json(getNovelTree(id));
}
