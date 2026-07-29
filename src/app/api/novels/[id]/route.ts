import {
  createScene,
  deleteAct,
  deleteBeat,
  deleteChapter,
  getNovelTree,
  knowledgeBelongsToNovel,
  listAppearances,
  listKnowledge,
  listOverviewAnswers,
  listOverviewMessages,
  listSceneRevisions,
  reorderBeats,
  restoreSceneRevision,
  saveSceneContent,
  sceneBelongsToNovel,
  updateNovelOverview,
  updateSceneTitle,
  upsertAct,
  upsertBeat,
  upsertChapter,
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
  return Response.json({ ...tree, knowledge, overviewMessages, overviewAnswers });
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
    default:
      return Response.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed";
    const notFound = /not found/i.test(message);
    return Response.json({ error: message }, { status: notFound ? 404 : 500 });
  }
}
