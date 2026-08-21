import {
  createScene,
  deleteAct,
  deleteBeat,
  deleteChapter,
  deleteComp,
  getNovelTree,
  knowledgeBelongsToNovel,
  listAppearances,
  listCoachSessions,
  listComps,
  listKnowledge,
  listOverviewAnswers,
  listOverviewMessages,
  listSceneRevisions,
  moveChapter,
  reorderActs,
  reorderBeats,
  reorderChapters,
  replaceChapterBeats,
  restoreSceneRevision,
  saveSceneContent,
  sceneBelongsToNovel,
  chapterBelongsToNovel,
  listChapterChat,
  updateNovelOverview,
  updateSceneTitle,
  updateSceneSliders,
  upsertAct,
  upsertBeat,
  upsertChapter,
  upsertComp,
  upsertKnowledge,
  deleteKnowledge,
  setOverviewAnswer,
} from "@/lib/novels";
import { scanMentionsForScene } from "@/lib/mentions";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const tree = getNovelTree(id);
  if (!tree) return Response.json({ error: "Not found" }, { status: 404 });
  const knowledge = listKnowledge(id);
  const overviewMessages = listOverviewMessages(id);
  const overviewAnswers = listOverviewAnswers(id);
  const comps = listComps(id);
  return Response.json({ ...tree, knowledge, overviewMessages, overviewAnswers, comps });
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const body = (await req.json()) as {
    action: string;
    payload: Record<string, unknown>;
  };

  try {
    switch (body.action) {
    case "updateNovel":
      return Response.json(updateNovelOverview(id, body.payload as never));
    case "upsertAct":
      return Response.json(
        upsertAct({
          ...(body.payload as object as Parameters<typeof upsertAct>[0]),
          novelId: id,
        }),
      );
    case "upsertChapter":
      return Response.json(
        upsertChapter({
          ...(body.payload as object as Parameters<typeof upsertChapter>[0]),
          novelId: id,
        }),
      );
    case "upsertBeat":
      return Response.json(
        upsertBeat({
          ...(body.payload as object as Parameters<typeof upsertBeat>[0]),
          novelId: id,
        }),
      );
    case "createScene":
      return Response.json(
        createScene(
          String(body.payload.chapterId),
          id,
          String(body.payload.title ?? "New scene"),
        ),
      );
    case "saveScene": {
      const sceneId = String(body.payload.sceneId);
      const content = String(body.payload.content);
      const source = String(body.payload.source ?? "manual");
      const saved = saveSceneContent(sceneId, id, content, source);
      if (body.payload.scanMentions) scanMentionsForScene(id, sceneId);
      return Response.json(saved);
    }
    case "updateSceneTitle":
      return Response.json(
        updateSceneTitle(
          String(body.payload.sceneId),
          id,
          String(body.payload.title ?? "Scene"),
        ),
      );
    case "updateSceneSliders":
      return Response.json(
        updateSceneSliders(
          String(body.payload.sceneId),
          id,
          String(body.payload.slidersJson ?? "{}"),
        ),
      );
    case "listRevisions": {
      const sceneId = String(body.payload.sceneId);
      if (!sceneBelongsToNovel(sceneId, id)) {
        return Response.json({ error: "Scene not found" }, { status: 404 });
      }
      return Response.json(listSceneRevisions(sceneId));
    }
    case "restoreRevision":
      return Response.json(
        restoreSceneRevision(
          String(body.payload.sceneId),
          String(body.payload.revisionId),
          id,
        ),
      );
    case "upsertKnowledge":
      return Response.json(
        upsertKnowledge({
          ...(body.payload as object as Parameters<typeof upsertKnowledge>[0]),
          novelId: id,
        }),
      );
    case "deleteKnowledge":
      deleteKnowledge(String(body.payload.entryId), id);
      return Response.json({ ok: true });
    case "listAppearances": {
      const entryId = String(body.payload.entryId);
      if (!knowledgeBelongsToNovel(entryId, id)) {
        return Response.json({ error: "Knowledge entry not found" }, { status: 404 });
      }
      return Response.json(listAppearances(entryId));
    }
    case "scanMentions":
      return Response.json(
        scanMentionsForScene(id, String(body.payload.sceneId)),
      );
    case "listChapterChat": {
      const chapterId = String(body.payload.chapterId);
      if (!chapterBelongsToNovel(chapterId, id)) {
        return Response.json({ error: "Chapter not found" }, { status: 404 });
      }
      return Response.json(listChapterChat(id, chapterId));
    }
    case "reorderActs":
      return Response.json(reorderActs(id, body.payload.orderedIds as string[]));
    case "reorderChapters":
      return Response.json(
        reorderChapters(
          String(body.payload.actId),
          body.payload.orderedIds as string[],
          id,
        ),
      );
    case "moveChapter":
      return Response.json(
        moveChapter(
          String(body.payload.chapterId),
          String(body.payload.destActId),
          Number(body.payload.destIndex),
          id,
        ),
      );
    case "reorderBeats":
      return Response.json(
        reorderBeats(
          String(body.payload.chapterId),
          body.payload.orderedIds as string[],
          id,
        ),
      );
    case "deleteAct":
      deleteAct(String(body.payload.actId), id);
      return Response.json({ ok: true });
    case "deleteChapter":
      deleteChapter(String(body.payload.chapterId), id);
      return Response.json({ ok: true });
    case "deleteBeat":
      deleteBeat(String(body.payload.beatId), id);
      return Response.json({ ok: true });
    case "setOverviewAnswer":
      return Response.json(
        setOverviewAnswer(
          id,
          String(body.payload.questionId),
          String(body.payload.answer),
        ),
      );
    case "replaceBeats":
      return Response.json(
        replaceChapterBeats(
          String(body.payload.chapterId),
          id,
          body.payload.contents as string[],
        ),
      );
    case "listComps":
      return Response.json(listComps(id));
    case "upsertComp":
      return Response.json(
        upsertComp({
          ...(body.payload as object as Parameters<typeof upsertComp>[0]),
          novelId: id,
        }),
      );
    case "deleteComp":
      deleteComp(String(body.payload.compId), id);
      return Response.json({ ok: true });
    case "listCoachSessions":
      return Response.json(
        listCoachSessions(
          id,
          body.payload.task ? String(body.payload.task) : undefined,
          body.payload.sceneId ? String(body.payload.sceneId) : undefined,
        ),
      );
    default:
      return Response.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed";
    const notFound = /not found/i.test(message);
    return Response.json({ error: message }, { status: notFound ? 404 : 500 });
  }
}
