import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { acts, beats, chapters } from "@/db/schema";
import { AI_TASK_BY_ID, systemPromptForTask, toolsForTask } from "@/lib/ai-tasks";
import { knowledgeForSceneText } from "@/lib/mentions";
import {
  addChapterChatMessage,
  chapterBelongsToNovel,
  getChapterProse,
  getCommand,
  getNovelTree,
  listChapterChat,
  listKnowledge,
} from "@/lib/novels";
import { runNeedleLoop } from "@/lib/needle-loop";
import { actLabel, chapterLabel, findChapterPlace } from "@/lib/manuscript";
import { compileTemplate } from "@/lib/prompt";
import { buildCodex } from "@/lib/prompts/context";
import { agentSseResponse, type ChatMessage } from "@/lib/openrouter";
import { resolveTaskRuntime } from "@/lib/task-runtime";
import { plainFromTipTap } from "@/lib/utils";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const novelId = searchParams.get("novelId") ?? "";
  const chapterId = searchParams.get("chapterId") ?? "";
  if (!novelId || !chapterId || !chapterBelongsToNovel(chapterId, novelId)) {
    return Response.json({ error: "Chapter not found" }, { status: 404 });
  }
  return Response.json(listChapterChat(novelId, chapterId));
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      novelId: string;
      chapterId: string;
      message: string;
      selection?: string;
      actionSlug?: string;
      model?: string;
      persistOnly?: boolean;
      role?: "user" | "assistant";
    };

    if (!chapterBelongsToNovel(body.chapterId, body.novelId)) {
      return Response.json({ error: "Chapter not found" }, { status: 404 });
    }

    const meta = JSON.stringify({
      selection: body.selection?.trim() || undefined,
      actionSlug: body.actionSlug || undefined,
    });
    addChapterChatMessage(
      body.novelId,
      body.chapterId,
      body.role ?? "user",
      body.message || "(no note)",
      meta,
    );

    if (body.persistOnly) {
      return Response.json({ ok: true });
    }

    const task = AI_TASK_BY_ID.chapter_chat;
    const { model, temperature } = resolveTaskRuntime("chapter_chat", body.model);
    const tree = getNovelTree(body.novelId);
    if (!tree) return Response.json({ error: "Novel not found" }, { status: 404 });

    const db = getDb();
    const chapter = db.select().from(chapters).where(eq(chapters.id, body.chapterId)).get()!;
    const act = db.select().from(acts).where(eq(acts.id, chapter.actId)).get()!;
    const chapterBeats = db
      .select()
      .from(beats)
      .where(eq(beats.chapterId, chapter.id))
      .all();
    const prose = getChapterProse(chapter.id);
    const chapterPlain = prose ? plainFromTipTap(prose.content) : "";
    const mentionPack = [chapterPlain, body.selection, body.message].filter(Boolean).join("\n");
    const mentioned = knowledgeForSceneText(body.novelId, mentionPack);
    const place = findChapterPlace(tree.acts, chapter.id);
    const actTitle = place ? actLabel(place.actIndex, place.act.title) : act.title;
    const chapterTitle = place ? chapterLabel(place.chapterIndex, place.chapter.title) : chapter.title;
    const command = body.actionSlug ? getCommand(body.actionSlug) : null;
    const compiledAction = command
      ? compileTemplate(command.promptTemplate, {
          userInstruction: body.message,
          selection: body.selection ?? "",
          currentChapter: chapterPlain,
          currentScene: chapterPlain,
          chapterTitle,
          chapterGoal: chapter.goal ?? "",
          chapterSummary: chapter.summary ?? "",
          chapterBeats: chapterBeats.map((b, i) => `${i + 1}. ${b.content}`).join("\n"),
          mentionedCodex: buildCodex(mentioned),
          codex: buildCodex(listKnowledge(body.novelId)),
          knowledge: mentioned.map((e) => `- ${e.name} (${e.type}): ${e.summary}`).join("\n"),
          actTitle,
          novelPremise: tree.novel.premise ?? "",
        })
      : "";

    const system = `${systemPromptForTask("chapter_chat")}

Current chapter: ${actTitle} / ${chapterTitle}
Goal: ${chapter.goal || "(none)"}
Summary:
${chapter.summary || "(empty)"}
Beats:
${chapterBeats.map((b, i) => `${i + 1}. ${b.content}`).join("\n") || "(none)"}
Mentioned Codex:
${buildCodex(mentioned)}`;

    const userBits = [
      body.selection?.trim() ? `[Selection attached, ${body.selection.trim().length} chars]` : "",
      command ? `[Action attached: ${command.label} / ${command.slug}]` : "",
      body.message?.trim() || "Help with this chapter.",
      compiledAction ? `\n\nSaved action prompt:\n${compiledAction}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const history = listChapterChat(body.novelId, body.chapterId);
    const prior = history.slice(0, -1).slice(-22);
    const messages: ChatMessage[] = [
      { role: "system", content: system },
      ...prior.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user", content: userBits },
    ];

    // Tool calling always goes through the local Needle model: the big model
    // plans in plain language and Needle emits the concrete tool call.
    return agentSseResponse(async function* (signal) {
      let full = "";
      for await (const event of runNeedleLoop({
        model,
        temperature,
        messages,
        tools: toolsForTask(task),
        novelId: body.novelId,
        chapterId: body.chapterId,
        signal,
      })) {
        if (event.type === "token") full += event.text;
        if (event.type === "done") {
          full = event.text || full;
          if (full.trim()) {
            addChapterChatMessage(body.novelId, body.chapterId, "assistant", full.trim());
          }
        }
        yield event;
      }
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 },
    );
  }
}
