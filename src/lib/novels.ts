import { and, asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  acts,
  appSettings,
  beats,
  chapters,
  coachSessions,
  commandModelOverrides,
  compAnalyses,
  knowledgeAppearances,
  knowledgeEntries,
  novels,
  overviewAnswers,
  overviewChatMessages,
  chapterChatMessages,
  sceneRevisions,
  scenes,
  slashCommands,
  taskModelOverrides,
} from "@/db/schema";
import { EMPTY_DOC, id, now } from "@/lib/utils";

export function listNovels() {
  const db = getDb();
  return db.select().from(novels).orderBy(desc(novels.updatedAt)).all();
}

export function getNovel(novelId: string) {
  const db = getDb();
  return db.select().from(novels).where(eq(novels.id, novelId)).get();
}

export function createNovel(title: string) {
  const db = getDb();
  const novelId = id();
  const ts = now();
  db.insert(novels)
    .values({
      id: novelId,
      title,
      createdAt: ts,
      updatedAt: ts,
    })
    .run();
  upsertAct({ novelId, title: "" });
  return getNovel(novelId)!;
}

export function deleteNovel(novelId: string) {
  getDb().delete(novels).where(eq(novels.id, novelId)).run();
}

export function touchNovel(novelId: string) {
  getDb()
    .update(novels)
    .set({ updatedAt: now() })
    .where(eq(novels.id, novelId))
    .run();
}

export function getNovelTree(novelId: string) {
  const db = getDb();
  const novel = getNovel(novelId);
  if (!novel) return null;
  const actRows = db
    .select()
    .from(acts)
    .where(eq(acts.novelId, novelId))
    .orderBy(asc(acts.order))
    .all();
  const tree = actRows.map((act) => {
    const chapterRows = db
      .select()
      .from(chapters)
      .where(eq(chapters.actId, act.id))
      .orderBy(asc(chapters.order))
      .all();
    return {
      ...act,
      chapters: chapterRows.map((chapter) => {
        const beatRows = db
          .select()
          .from(beats)
          .where(eq(beats.chapterId, chapter.id))
          .orderBy(asc(beats.order))
          .all();
        const sceneRows = db
          .select()
          .from(scenes)
          .where(eq(scenes.chapterId, chapter.id))
          .orderBy(asc(scenes.order))
          .all();
        const prose = sceneRows[0] ?? null;
        return { ...chapter, beats: beatRows, prose, scenes: prose ? [prose] : [] };
      }),
    };
  });
  return { novel, acts: tree };
}

function assertActInNovel(actId: string, novelId: string) {
  const act = getDb().select().from(acts).where(eq(acts.id, actId)).get();
  if (!act || act.novelId !== novelId) throw new Error("Act not found");
  return act;
}

function assertChapterInNovel(chapterId: string, novelId: string) {
  const chapter = getDb().select().from(chapters).where(eq(chapters.id, chapterId)).get();
  if (!chapter) throw new Error("Chapter not found");
  assertActInNovel(chapter.actId, novelId);
  return chapter;
}

function assertSceneInNovel(sceneId: string, novelId: string) {
  const scene = getDb().select().from(scenes).where(eq(scenes.id, sceneId)).get();
  if (!scene) throw new Error("Scene not found");
  assertChapterInNovel(scene.chapterId, novelId);
  return scene;
}

function assertBeatInNovel(beatId: string, novelId: string) {
  const beat = getDb().select().from(beats).where(eq(beats.id, beatId)).get();
  if (!beat) throw new Error("Beat not found");
  assertChapterInNovel(beat.chapterId, novelId);
  return beat;
}

function assertKnowledgeInNovel(entryId: string, novelId: string) {
  const entry = getDb()
    .select()
    .from(knowledgeEntries)
    .where(eq(knowledgeEntries.id, entryId))
    .get();
  if (!entry || entry.novelId !== novelId) throw new Error("Knowledge entry not found");
  return entry;
}

export function upsertAct(input: {
  id?: string;
  novelId: string;
  title: string;
  order?: number;
  brief?: string;
  introduces?: string;
  accomplishes?: string;
  losses?: string;
  stateStart?: string;
  stateEnd?: string;
  summary?: string;
}) {
  const db = getDb();
  if (input.id) {
    assertActInNovel(input.id, input.novelId);
    const patch: Record<string, unknown> = { title: input.title };
    if (input.brief !== undefined) patch.brief = input.brief;
    if (input.introduces !== undefined) patch.introduces = input.introduces;
    if (input.accomplishes !== undefined) patch.accomplishes = input.accomplishes;
    if (input.losses !== undefined) patch.losses = input.losses;
    if (input.stateStart !== undefined) patch.stateStart = input.stateStart;
    if (input.stateEnd !== undefined) patch.stateEnd = input.stateEnd;
    if (input.summary !== undefined) {
      patch.summary = input.summary;
      patch.summaryUpdatedAt = now();
    }
    if (input.order != null) patch.order = input.order;
    db.update(acts).set(patch).where(eq(acts.id, input.id)).run();
    touchNovel(input.novelId);
    return db.select().from(acts).where(eq(acts.id, input.id)).get()!;
  }
  const max = db
    .select()
    .from(acts)
    .where(eq(acts.novelId, input.novelId))
    .all()
    .reduce((m, a) => Math.max(m, a.order), -1);
  const actId = id();
  db.insert(acts)
    .values({
      id: actId,
      novelId: input.novelId,
      order: input.order ?? max + 1,
      title: input.title,
      brief: input.brief ?? "",
      introduces: input.introduces ?? "",
      accomplishes: input.accomplishes ?? "",
      losses: input.losses ?? "",
      stateStart: input.stateStart ?? "",
      stateEnd: input.stateEnd ?? "",
    })
    .run();
  touchNovel(input.novelId);
  upsertChapter({
    actId,
    novelId: input.novelId,
    title: "",
  });
  return db.select().from(acts).where(eq(acts.id, actId)).get()!;
}

export function upsertChapter(input: {
  id?: string;
  actId?: string;
  novelId: string;
  title: string;
  order?: number;
  goal?: string;
  summary?: string;
}) {
  const db = getDb();
  if (input.id) {
    assertChapterInNovel(input.id, input.novelId);
    const patch: Record<string, unknown> = { title: input.title };
    if (input.goal !== undefined) patch.goal = input.goal;
    if (input.summary !== undefined) {
      patch.summary = input.summary;
      patch.summaryUpdatedAt = now();
    }
    if (input.order != null) patch.order = input.order;
    db.update(chapters).set(patch).where(eq(chapters.id, input.id)).run();
    touchNovel(input.novelId);
    return db.select().from(chapters).where(eq(chapters.id, input.id)).get()!;
  }
  if (!input.actId) throw new Error("actId required to create a chapter");
  assertActInNovel(input.actId, input.novelId);
  const max = db
    .select()
    .from(chapters)
    .where(eq(chapters.actId, input.actId))
    .all()
    .reduce((m, c) => Math.max(m, c.order), -1);
  const chapterId = id();
  db.insert(chapters)
    .values({
      id: chapterId,
      actId: input.actId,
      order: input.order ?? max + 1,
      title: input.title,
      goal: input.goal ?? "",
    })
    .run();
  // default empty prose document for the chapter
  db.insert(scenes)
    .values({
      id: id(),
      chapterId,
      order: 0,
      title: "",
      content: EMPTY_DOC,
      updatedAt: now(),
    })
    .run();
  touchNovel(input.novelId);
  return db.select().from(chapters).where(eq(chapters.id, chapterId)).get()!;
}

export function upsertBeat(input: {
  id?: string;
  chapterId: string;
  novelId: string;
  content: string;
  order?: number;
}) {
  const db = getDb();
  assertChapterInNovel(input.chapterId, input.novelId);
  if (input.id) {
    assertBeatInNovel(input.id, input.novelId);
    db.update(beats)
      .set({
        content: input.content,
        ...(input.order != null ? { order: input.order } : {}),
      })
      .where(eq(beats.id, input.id))
      .run();
    touchNovel(input.novelId);
    return db.select().from(beats).where(eq(beats.id, input.id)).get()!;
  }
  const max = db
    .select()
    .from(beats)
    .where(eq(beats.chapterId, input.chapterId))
    .all()
    .reduce((m, b) => Math.max(m, b.order), -1);
  const beatId = id();
  db.insert(beats)
    .values({
      id: beatId,
      chapterId: input.chapterId,
      order: input.order ?? max + 1,
      content: input.content,
    })
    .run();
  touchNovel(input.novelId);
  return db.select().from(beats).where(eq(beats.id, beatId)).get()!;
}

export function createScene(chapterId: string, novelId: string, title = "") {
  assertChapterInNovel(chapterId, novelId);
  const existing = getChapterProse(chapterId);
  if (existing) return existing;
  const db = getDb();
  const max = db
    .select()
    .from(scenes)
    .where(eq(scenes.chapterId, chapterId))
    .all()
    .reduce((m, s) => Math.max(m, s.order), -1);
  const sceneId = id();
  const content = EMPTY_DOC;
  db.insert(scenes)
    .values({
      id: sceneId,
      chapterId,
      order: max + 1,
      title,
      content,
      updatedAt: now(),
    })
    .run();
  db.insert(sceneRevisions)
    .values({
      id: id(),
      sceneId,
      createdAt: now(),
      source: "manual",
      label: "Initial",
      content,
    })
    .run();
  touchNovel(novelId);
  return db.select().from(scenes).where(eq(scenes.id, sceneId)).get()!;
}

export function updateSceneTitle(sceneId: string, novelId: string, title: string) {
  const db = getDb();
  assertSceneInNovel(sceneId, novelId);
  db.update(scenes)
    .set({ title, updatedAt: now() })
    .where(eq(scenes.id, sceneId))
    .run();
  touchNovel(novelId);
  return db.select().from(scenes).where(eq(scenes.id, sceneId)).get()!;
}

export function updateSceneSliders(sceneId: string, novelId: string, slidersJson: string) {
  const db = getDb();
  assertSceneInNovel(sceneId, novelId);
  db.update(scenes)
    .set({ slidersJson, updatedAt: now() })
    .where(eq(scenes.id, sceneId))
    .run();
  touchNovel(novelId);
  return db.select().from(scenes).where(eq(scenes.id, sceneId)).get()!;
}

export function saveSceneContent(
  sceneId: string,
  novelId: string,
  content: string,
  source: string = "manual",
  label?: string,
) {
  const db = getDb();
  const existing = assertSceneInNovel(sceneId, novelId);
  if (existing.content === content) return existing;

  db.update(scenes)
    .set({ content, updatedAt: now() })
    .where(eq(scenes.id, sceneId))
    .run();

  const latest = db
    .select()
    .from(sceneRevisions)
    .where(eq(sceneRevisions.sceneId, sceneId))
    .orderBy(desc(sceneRevisions.createdAt))
    .get();

  db.insert(sceneRevisions)
    .values({
      id: id(),
      sceneId,
      createdAt: now(),
      source,
      label: label ?? null,
      content,
      parentRevisionId: latest?.id ?? null,
    })
    .run();
  touchNovel(novelId);
  return db.select().from(scenes).where(eq(scenes.id, sceneId)).get()!;
}

export function listSceneRevisions(sceneId: string, limit = 20) {
  return getDb()
    .select()
    .from(sceneRevisions)
    .where(eq(sceneRevisions.sceneId, sceneId))
    .orderBy(desc(sceneRevisions.createdAt))
    .limit(limit)
    .all();
}

export function restoreSceneRevision(sceneId: string, revisionId: string, novelId: string) {
  const db = getDb();
  const revision = db
    .select()
    .from(sceneRevisions)
    .where(and(eq(sceneRevisions.id, revisionId), eq(sceneRevisions.sceneId, sceneId)))
    .get();
  if (!revision) throw new Error("Revision not found");
  return saveSceneContent(sceneId, novelId, revision.content, "restore", `Restored ${revisionId.slice(0, 6)}`);
}

export function getSettings() {
  const db = getDb();
  let row = db.select().from(appSettings).where(eq(appSettings.id, 1)).get();
  if (!row) {
    db.insert(appSettings)
      .values({ id: 1, openrouterApiKey: "", defaultModel: "anthropic/claude-sonnet-4", theme: "system" })
      .run();
    row = db.select().from(appSettings).where(eq(appSettings.id, 1)).get()!;
  }
  return row;
}

export function updateSettings(patch: Partial<{
  openrouterApiKey: string;
  defaultModel: string;
  theme: string;
  densityThresholdsJson: string;
  craftPipeline: boolean;
  needleTools: boolean;
}>) {
  getDb().update(appSettings).set(patch).where(eq(appSettings.id, 1)).run();
  return getSettings();
}

export function listCommands() {
  return getDb().select().from(slashCommands).all();
}

export function getCommand(slug: string) {
  return getDb().select().from(slashCommands).where(eq(slashCommands.slug, slug)).get();
}

export function setCommandFavorite(id: string, favorite: boolean) {
  const db = getDb();
  db.update(slashCommands).set({ favorite }).where(eq(slashCommands.id, id)).run();
  return db.select().from(slashCommands).where(eq(slashCommands.id, id)).get();
}

export function getCommandOverride(commandId: string, modelId: string) {
  return getDb()
    .select()
    .from(commandModelOverrides)
    .where(
      and(
        eq(commandModelOverrides.commandId, commandId),
        eq(commandModelOverrides.modelId, modelId),
      ),
    )
    .get();
}

export function listKnowledge(novelId: string) {
  return getDb()
    .select()
    .from(knowledgeEntries)
    .where(eq(knowledgeEntries.novelId, novelId))
    .orderBy(asc(knowledgeEntries.name))
    .all();
}

export function upsertKnowledge(input: {
  id?: string;
  novelId: string;
  type: string;
  name: string;
  aliases?: string;
  summary?: string;
  notes?: string;
  slidersJson?: string;
}) {
  const db = getDb();
  if (input.id) {
    assertKnowledgeInNovel(input.id, input.novelId);
    const existing = db.select().from(knowledgeEntries).where(eq(knowledgeEntries.id, input.id)).get()!;
    db.update(knowledgeEntries)
      .set({
        type: input.type,
        name: input.name,
        aliases: input.aliases,
        summary: input.summary,
        notes: input.notes,
        slidersJson: input.slidersJson ?? existing.slidersJson,
        updatedAt: now(),
      })
      .where(eq(knowledgeEntries.id, input.id))
      .run();
    return db.select().from(knowledgeEntries).where(eq(knowledgeEntries.id, input.id)).get()!;
  }
  const entryId = id();
  db.insert(knowledgeEntries)
    .values({
      id: entryId,
      novelId: input.novelId,
      type: input.type,
      name: input.name,
      aliases: input.aliases ?? "",
      summary: input.summary ?? "",
      notes: input.notes ?? "",
      slidersJson: input.slidersJson ?? "{}",
      updatedAt: now(),
    })
    .run();
  return db.select().from(knowledgeEntries).where(eq(knowledgeEntries.id, entryId)).get()!;
}

export function deleteKnowledge(entryId: string, novelId?: string) {
  if (novelId) assertKnowledgeInNovel(entryId, novelId);
  getDb().delete(knowledgeEntries).where(eq(knowledgeEntries.id, entryId)).run();
}

export function clearKnowledge(novelId: string) {
  getDb().delete(knowledgeEntries).where(eq(knowledgeEntries.novelId, novelId)).run();
}

export function clearOverviewAnswers(novelId: string) {
  getDb().delete(overviewAnswers).where(eq(overviewAnswers.novelId, novelId)).run();
}

export function listAppearances(entryId: string) {
  return getDb()
    .select()
    .from(knowledgeAppearances)
    .where(eq(knowledgeAppearances.entryId, entryId))
    .orderBy(desc(knowledgeAppearances.createdAt))
    .all();
}

export function listOverviewMessages(novelId: string) {
  return getDb()
    .select()
    .from(overviewChatMessages)
    .where(eq(overviewChatMessages.novelId, novelId))
    .orderBy(asc(overviewChatMessages.createdAt))
    .all();
}

export function addOverviewMessage(novelId: string, role: string, content: string) {
  const msgId = id();
  getDb()
    .insert(overviewChatMessages)
    .values({ id: msgId, novelId, role, content, createdAt: now() })
    .run();
  return getDb().select().from(overviewChatMessages).where(eq(overviewChatMessages.id, msgId)).get()!;
}

export function listOverviewAnswers(novelId: string) {
  return getDb()
    .select()
    .from(overviewAnswers)
    .where(eq(overviewAnswers.novelId, novelId))
    .all();
}

export function setOverviewAnswer(novelId: string, questionId: string, answer: string) {
  const db = getDb();
  const existing = db
    .select()
    .from(overviewAnswers)
    .where(and(eq(overviewAnswers.novelId, novelId), eq(overviewAnswers.questionId, questionId)))
    .get();
  if (existing) {
    db.update(overviewAnswers)
      .set({ answer, updatedAt: now() })
      .where(eq(overviewAnswers.id, existing.id))
      .run();
    return db.select().from(overviewAnswers).where(eq(overviewAnswers.id, existing.id)).get()!;
  }
  const answerId = id();
  db.insert(overviewAnswers)
    .values({ id: answerId, novelId, questionId, answer, updatedAt: now() })
    .run();
  return db.select().from(overviewAnswers).where(eq(overviewAnswers.id, answerId)).get()!;
}

export function updateNovelOverview(
  novelId: string,
  patch: Partial<{
    title: string;
    premise: string;
    genre: string;
    tone: string;
    themes: string;
    stakes: string;
    protagonistFocus: string;
    endingIntention: string;
    notes: string;
    overviewChecklistJson: string;
    styleGuideJson: string;
    styleSamplesJson: string;
  }>,
) {
  getDb().update(novels).set({ ...patch, updatedAt: now() }).where(eq(novels.id, novelId)).run();
  return getNovel(novelId)!;
}

export function deleteAct(actId: string, novelId: string) {
  assertActInNovel(actId, novelId);
  getDb().delete(acts).where(eq(acts.id, actId)).run();
  touchNovel(novelId);
}

export function deleteChapter(chapterId: string, novelId: string) {
  assertChapterInNovel(chapterId, novelId);
  getDb().delete(chapters).where(eq(chapters.id, chapterId)).run();
  touchNovel(novelId);
}

export function deleteBeat(beatId: string, novelId: string) {
  assertBeatInNovel(beatId, novelId);
  getDb().delete(beats).where(eq(beats.id, beatId)).run();
  touchNovel(novelId);
}

export function reorderActs(novelId: string, orderedIds: string[]) {
  const db = getDb();
  for (const actId of orderedIds) {
    assertActInNovel(actId, novelId);
  }
  orderedIds.forEach((actId, index) => {
    db.update(acts).set({ order: index }).where(eq(acts.id, actId)).run();
  });
  touchNovel(novelId);
  return db.select().from(acts).where(eq(acts.novelId, novelId)).orderBy(asc(acts.order)).all();
}

export function reorderChapters(actId: string, orderedIds: string[], novelId: string) {
  assertActInNovel(actId, novelId);
  const db = getDb();
  for (const chapterId of orderedIds) {
    const chapter = assertChapterInNovel(chapterId, novelId);
    if (chapter.actId !== actId) throw new Error("Chapter not in act");
  }
  orderedIds.forEach((chapterId, index) => {
    db.update(chapters).set({ order: index }).where(eq(chapters.id, chapterId)).run();
  });
  touchNovel(novelId);
  return db
    .select()
    .from(chapters)
    .where(eq(chapters.actId, actId))
    .orderBy(asc(chapters.order))
    .all();
}

export function moveChapter(
  chapterId: string,
  destActId: string,
  destIndex: number,
  novelId: string,
) {
  const chapter = assertChapterInNovel(chapterId, novelId);
  assertActInNovel(destActId, novelId);
  const db = getDb();
  const sourceActId = chapter.actId;
  const destRows = db
    .select()
    .from(chapters)
    .where(eq(chapters.actId, destActId))
    .orderBy(asc(chapters.order))
    .all()
    .filter((row) => row.id !== chapterId);
  const clamped = Math.max(0, Math.min(destIndex, destRows.length));
  destRows.splice(clamped, 0, chapter);
  destRows.forEach((row, index) => {
    db.update(chapters)
      .set({ actId: destActId, order: index })
      .where(eq(chapters.id, row.id))
      .run();
  });
  if (sourceActId !== destActId) {
    const sourceRows = db
      .select()
      .from(chapters)
      .where(eq(chapters.actId, sourceActId))
      .orderBy(asc(chapters.order))
      .all();
    sourceRows.forEach((row, index) => {
      db.update(chapters).set({ order: index }).where(eq(chapters.id, row.id)).run();
    });
  }
  touchNovel(novelId);
  return db.select().from(chapters).where(eq(chapters.id, chapterId)).get()!;
}

export function reorderBeats(chapterId: string, orderedIds: string[], novelId: string) {
  assertChapterInNovel(chapterId, novelId);
  const db = getDb();
  for (const beatId of orderedIds) {
    assertBeatInNovel(beatId, novelId);
  }
  orderedIds.forEach((beatId, index) => {
    db.update(beats).set({ order: index }).where(eq(beats.id, beatId)).run();
  });
  touchNovel(novelId);
  return db
    .select()
    .from(beats)
    .where(eq(beats.chapterId, chapterId))
    .orderBy(asc(beats.order))
    .all();
}

export function sceneBelongsToNovel(sceneId: string, novelId: string) {
  try {
    assertSceneInNovel(sceneId, novelId);
    return true;
  } catch {
    return false;
  }
}

export function chapterBelongsToNovel(chapterId: string, novelId: string) {
  try {
    assertChapterInNovel(chapterId, novelId);
    return true;
  } catch {
    return false;
  }
}

export function getChapterProse(chapterId: string) {
  return (
    getDb()
      .select()
      .from(scenes)
      .where(eq(scenes.chapterId, chapterId))
      .orderBy(asc(scenes.order))
      .get() ?? null
  );
}

export function ensureChapterProse(chapterId: string, novelId: string) {
  return getChapterProse(chapterId) ?? createScene(chapterId, novelId, "");
}

export function listChapterChat(novelId: string, chapterId: string) {
  return getDb()
    .select()
    .from(chapterChatMessages)
    .where(
      and(
        eq(chapterChatMessages.novelId, novelId),
        eq(chapterChatMessages.chapterId, chapterId),
      ),
    )
    .orderBy(asc(chapterChatMessages.createdAt))
    .all();
}

export function addChapterChatMessage(
  novelId: string,
  chapterId: string,
  role: string,
  content: string,
  metaJson = "",
) {
  const msgId = id();
  getDb()
    .insert(chapterChatMessages)
    .values({
      id: msgId,
      novelId,
      chapterId,
      role,
      content,
      metaJson,
      createdAt: now(),
    })
    .run();
  return getDb()
    .select()
    .from(chapterChatMessages)
    .where(eq(chapterChatMessages.id, msgId))
    .get()!;
}

export function knowledgeBelongsToNovel(entryId: string, novelId: string) {
  try {
    assertKnowledgeInNovel(entryId, novelId);
    return true;
  } catch {
    return false;
  }
}

export function getTaskOverride(taskId: string) {
  return getDb()
    .select()
    .from(taskModelOverrides)
    .where(eq(taskModelOverrides.taskId, taskId))
    .get();
}

export function listTaskOverrides() {
  return getDb().select().from(taskModelOverrides).all();
}

export function upsertTaskOverride(input: {
  taskId: string;
  modelId: string;
  temperature?: number | null;
}) {
  const db = getDb();
  const existing = getTaskOverride(input.taskId);
  if (existing) {
    db.update(taskModelOverrides)
      .set({
        modelId: input.modelId,
        temperature: input.temperature ?? null,
      })
      .where(eq(taskModelOverrides.id, existing.id))
      .run();
    return getTaskOverride(input.taskId)!;
  }
  db.insert(taskModelOverrides)
    .values({
      id: id(),
      taskId: input.taskId,
      modelId: input.modelId,
      temperature: input.temperature ?? null,
    })
    .run();
  return getTaskOverride(input.taskId)!;
}

export function replaceChapterBeats(
  chapterId: string,
  novelId: string,
  contents: string[],
) {
  assertChapterInNovel(chapterId, novelId);
  const db = getDb();
  db.delete(beats).where(eq(beats.chapterId, chapterId)).run();
  contents.forEach((content, index) => {
    db.insert(beats)
      .values({
        id: id(),
        chapterId,
        order: index,
        content,
      })
      .run();
  });
  touchNovel(novelId);
  return db
    .select()
    .from(beats)
    .where(eq(beats.chapterId, chapterId))
    .orderBy(asc(beats.order))
    .all();
}

export function listCoachSessions(novelId: string, task?: string, sceneId?: string) {
  const db = getDb();
  const rows = db
    .select()
    .from(coachSessions)
    .where(eq(coachSessions.novelId, novelId))
    .orderBy(desc(coachSessions.updatedAt))
    .all();
  return rows.filter((r) => {
    if (task && r.task !== task) return false;
    if (sceneId && r.sceneId !== sceneId) return false;
    return true;
  });
}

export function getCoachSession(sessionId: string, novelId: string) {
  const row = getDb()
    .select()
    .from(coachSessions)
    .where(eq(coachSessions.id, sessionId))
    .get();
  if (!row || row.novelId !== novelId) return null;
  return row;
}

export function saveCoachSession(input: {
  id?: string;
  novelId: string;
  sceneId?: string | null;
  chapterId?: string | null;
  task: string;
  messagesJson: string;
  densityJson?: string | null;
}) {
  const db = getDb();
  const ts = now();
  if (input.id) {
    const existing = getCoachSession(input.id, input.novelId);
    if (!existing) throw new Error("Session not found");
    db.update(coachSessions)
      .set({
        messagesJson: input.messagesJson,
        densityJson: input.densityJson ?? existing.densityJson,
        sceneId: input.sceneId ?? existing.sceneId,
        chapterId: input.chapterId ?? existing.chapterId,
        updatedAt: ts,
      })
      .where(eq(coachSessions.id, input.id))
      .run();
    return getCoachSession(input.id, input.novelId)!;
  }
  const sessionId = id();
  db.insert(coachSessions)
    .values({
      id: sessionId,
      novelId: input.novelId,
      sceneId: input.sceneId ?? null,
      chapterId: input.chapterId ?? null,
      task: input.task,
      messagesJson: input.messagesJson,
      densityJson: input.densityJson ?? "",
      createdAt: ts,
      updatedAt: ts,
    })
    .run();
  return getCoachSession(sessionId, input.novelId)!;
}

export function listComps(novelId: string) {
  return getDb()
    .select()
    .from(compAnalyses)
    .where(eq(compAnalyses.novelId, novelId))
    .orderBy(desc(compAnalyses.createdAt))
    .all();
}

export function upsertComp(input: {
  id?: string;
  novelId: string;
  title: string;
  author?: string;
  notes?: string;
  chapterBreakdownJson?: string;
}) {
  const db = getDb();
  if (input.id) {
    const existing = db.select().from(compAnalyses).where(eq(compAnalyses.id, input.id)).get();
    if (!existing || existing.novelId !== input.novelId) throw new Error("Comp not found");
    db.update(compAnalyses)
      .set({
        title: input.title,
        author: input.author ?? existing.author,
        notes: input.notes ?? existing.notes,
        chapterBreakdownJson: input.chapterBreakdownJson ?? existing.chapterBreakdownJson,
      })
      .where(eq(compAnalyses.id, input.id))
      .run();
    return db.select().from(compAnalyses).where(eq(compAnalyses.id, input.id)).get()!;
  }
  const compId = id();
  db.insert(compAnalyses)
    .values({
      id: compId,
      novelId: input.novelId,
      title: input.title,
      author: input.author ?? "",
      notes: input.notes ?? "",
      chapterBreakdownJson: input.chapterBreakdownJson ?? "",
      createdAt: now(),
    })
    .run();
  return db.select().from(compAnalyses).where(eq(compAnalyses.id, compId)).get()!;
}

export function deleteComp(compId: string, novelId: string) {
  const existing = getDb().select().from(compAnalyses).where(eq(compAnalyses.id, compId)).get();
  if (!existing || existing.novelId !== novelId) throw new Error("Comp not found");
  getDb().delete(compAnalyses).where(eq(compAnalyses.id, compId)).run();
}
