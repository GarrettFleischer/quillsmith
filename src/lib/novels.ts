import { and, asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  acts,
  appSettings,
  beats,
  chapters,
  commandModelOverrides,
  knowledgeAppearances,
  knowledgeEntries,
  novels,
  overviewAnswers,
  overviewChatMessages,
  sceneRevisions,
  scenes,
  slashCommands,
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
        return { ...chapter, beats: beatRows, scenes: sceneRows };
      }),
    };
  });
  return { novel, acts: tree };
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
}) {
  const db = getDb();
  if (input.id) {
    const patch: Record<string, unknown> = { title: input.title };
    if (input.brief !== undefined) patch.brief = input.brief;
    if (input.introduces !== undefined) patch.introduces = input.introduces;
    if (input.accomplishes !== undefined) patch.accomplishes = input.accomplishes;
    if (input.losses !== undefined) patch.losses = input.losses;
    if (input.stateStart !== undefined) patch.stateStart = input.stateStart;
    if (input.stateEnd !== undefined) patch.stateEnd = input.stateEnd;
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
  return db.select().from(acts).where(eq(acts.id, actId)).get()!;
}

export function upsertChapter(input: {
  id?: string;
  actId: string;
  novelId: string;
  title: string;
  order?: number;
  goal?: string;
}) {
  const db = getDb();
  if (input.id) {
    const patch: Record<string, unknown> = { title: input.title };
    if (input.goal !== undefined) patch.goal = input.goal;
    if (input.order != null) patch.order = input.order;
    db.update(chapters).set(patch).where(eq(chapters.id, input.id)).run();
    touchNovel(input.novelId);
    return db.select().from(chapters).where(eq(chapters.id, input.id)).get()!;
  }
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
  // default empty scene for writing
  db.insert(scenes)
    .values({
      id: id(),
      chapterId,
      order: 0,
      title: "Scene 1",
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
  if (input.id) {
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

export function createScene(chapterId: string, novelId: string, title = "New scene") {
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
  const existing = db.select().from(scenes).where(eq(scenes.id, sceneId)).get();
  if (!existing) throw new Error("Scene not found");
  db.update(scenes)
    .set({ title, updatedAt: now() })
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
  const existing = db.select().from(scenes).where(eq(scenes.id, sceneId)).get();
  if (!existing) throw new Error("Scene not found");
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
}) {
  const db = getDb();
  if (input.id) {
    db.update(knowledgeEntries)
      .set({
        type: input.type,
        name: input.name,
        aliases: input.aliases,
        summary: input.summary,
        notes: input.notes,
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
      updatedAt: now(),
    })
    .run();
  return db.select().from(knowledgeEntries).where(eq(knowledgeEntries.id, entryId)).get()!;
}

export function deleteKnowledge(entryId: string) {
  getDb().delete(knowledgeEntries).where(eq(knowledgeEntries.id, entryId)).run();
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
  }>,
) {
  getDb().update(novels).set({ ...patch, updatedAt: now() }).where(eq(novels.id, novelId)).run();
  return getNovel(novelId)!;
}

export function deleteAct(actId: string, novelId: string) {
  getDb().delete(acts).where(eq(acts.id, actId)).run();
  touchNovel(novelId);
}

export function deleteChapter(chapterId: string, novelId: string) {
  getDb().delete(chapters).where(eq(chapters.id, chapterId)).run();
  touchNovel(novelId);
}

export function deleteBeat(beatId: string, novelId: string) {
  getDb().delete(beats).where(eq(beats.id, beatId)).run();
  touchNovel(novelId);
}

export function reorderBeats(chapterId: string, orderedIds: string[], novelId: string) {
  const db = getDb();
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
