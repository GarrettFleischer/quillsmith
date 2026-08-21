import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { acts, beats, chapters, scenes } from "@/db/schema";
import {
  AI_TASK_BY_ID,
  checkIdFromTask,
  isAiTaskId,
  systemPromptForTask,
  tellIdFromScrubTask,
  type AiTaskId,
} from "@/lib/ai-tasks";
import { parseImprovementPlan } from "@/lib/checks";
import { analyzePassageDensity, parseDensityThresholds, parseTellHits } from "@/lib/ai-tell-density";
import {
  getNovelTree,
  getSettings,
  listKnowledge,
  listOverviewAnswers,
  saveCoachSession,
  sceneBelongsToNovel,
} from "@/lib/novels";
import {
  agentSseResponse,
  collectAgentText,
  extractJsonObject,
  runAgentLoop,
  type ChatMessage,
} from "@/lib/openrouter";
import { scrubUserMessage } from "@/lib/prompts/scrubbers";
import { resolveTaskRuntime } from "@/lib/task-runtime";
import { plainFromTipTap } from "@/lib/utils";

export const runtime = "nodejs";

type HistoryTurn = { role: "user" | "assistant"; content: string };

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      task: string;
      novelId: string;
      sceneId?: string;
      chapterId?: string;
      persona?: string;
      message?: string;
      history?: HistoryTurn[];
      model?: string;
      scrubMode?: "identify" | "rewrite";
      checkMode?: "plan" | "apply";
      improvementPlan?: string;
      exemplar?: string;
      sessionId?: string;
      persist?: boolean;
      passage?: string;
    };

    if (!isAiTaskId(body.task)) {
      return Response.json({ error: "Unknown task" }, { status: 400 });
    }
    const taskId = body.task as AiTaskId;
    const task = AI_TASK_BY_ID[taskId];
    if (task.writesScene) {
      return Response.json({ error: "Coach never writes the manuscript" }, { status: 400 });
    }

    const tree = getNovelTree(body.novelId);
    if (!tree) return Response.json({ error: "Novel not found" }, { status: 404 });

    if (body.sceneId && !sceneBelongsToNovel(body.sceneId, body.novelId)) {
      return Response.json({ error: "Scene not found" }, { status: 404 });
    }

    const db = getDb();
    const scene = body.sceneId
      ? db.select().from(scenes).where(eq(scenes.id, body.sceneId)).get()
      : null;
    const chapterId = body.chapterId || scene?.chapterId;
    const chapter = chapterId
      ? db.select().from(chapters).where(eq(chapters.id, chapterId)).get()
      : null;
    const chapterBeats = chapter
      ? db
          .select()
          .from(beats)
          .where(eq(beats.chapterId, chapter.id))
          .orderBy(asc(beats.order))
          .all()
      : [];
    const chapterScenes = chapter
      ? db
          .select()
          .from(scenes)
          .where(eq(scenes.chapterId, chapter.id))
          .orderBy(asc(scenes.order))
          .all()
      : [];
    const act = chapter
      ? db.select().from(acts).where(eq(acts.id, chapter.actId)).get()
      : null;

    const scenePlain = scene ? plainFromTipTap(scene.content) : "";
    const chapterPlain = chapterScenes.map((s) => plainFromTipTap(s.content)).join("\n\n");
    const passageOverride = body.passage?.trim() || "";
    const { model, temperature } = resolveTaskRuntime(taskId, body.model);
    const tellId = tellIdFromScrubTask(taskId);
    const checkId = checkIdFromTask(taskId);
    const checkMode = body.checkMode ?? (checkId ? "plan" : undefined);
    const system = systemPromptForTask(taskId, {
      scrubMode: body.scrubMode ?? "identify",
      tellId: tellId ?? undefined,
      checkId: checkId ?? undefined,
      checkMode,
    });

    const answers = listOverviewAnswers(body.novelId);
    const placement = [
      tree.novel.title && `Novel: ${tree.novel.title}`,
      act && `Act: ${act.title}`,
      chapter && `Chapter: ${chapter.title}`,
      chapter?.goal && `Chapter goal: ${chapter.goal}`,
      chapterBeats.length
        ? `Planned beats:\n${chapterBeats.map((b, i) => `${i + 1}. ${b.content}`).join("\n")}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    let userContent = "";
    if (taskId === "coach_interview") {
      userContent = `${placement}

Current scene (may be empty):
${scenePlain || "(blank page)"}

Author: ${body.message?.trim() || "I'm stuck. Interview me about this scene."}`;
    } else if (taskId === "coach_critique") {
      userContent = `${placement}

Scene to critique:
${scenePlain || "(empty)"}

${body.message?.trim() ?? ""}`;
    } else if (taskId === "coach_tutor") {
      userContent = `${placement}

Exemplar:
${body.exemplar?.trim() || "(none provided)"}

Author passage:
${scenePlain || body.message || "(empty)"}`;
    } else if (taskId === "coach_reverse_outline") {
      userContent = `${placement}

Chapter prose:
${chapterPlain || scenePlain || "(empty)"}`;
    } else if (taskId === "coach_beta") {
      userContent = `Persona: ${body.persona || "genre_fan"}
Genre/tone notes: ${answers.find((a) => a.questionId === "novel.genre_tone")?.answer ?? tree.novel.genre ?? ""}

${placement}

Chapter/scene:
${scenePlain || chapterPlain || "(empty)"}`;
    } else if (taskId === "overview_outline_variants") {
      userContent = `Existing outline and answers:
${JSON.stringify(
  {
    novel: tree.novel,
    acts: tree.acts.map((a) => ({
      title: a.title,
      brief: a.brief,
      chapters: a.chapters.map((c) => ({
        title: c.title,
        goal: c.goal,
        beats: c.beats.map((b) => b.content),
      })),
    })),
    answers,
  },
  null,
  2,
)}

${body.message?.trim() || "Propose 2–3 distinct outline arrangements."}`;
    } else if (taskId === "coach_physics") {
      const characters = listKnowledge(body.novelId)
        .filter((e) => e.type === "character")
        .map((e) => `- ${e.name}${e.aliases ? ` (${e.aliases})` : ""}`)
        .join("\n");
      userContent = `${placement}

Characters in the knowledge base (use these names):
${characters || "(none yet)"}

Scene:
${scenePlain || "(empty — use beats)"}`;
    } else if (taskId === "layer_brief") {
      userContent = `${placement}

Scene-relevant notes and current prose:
${scenePlain || "(blank page — brief from beats only)"}`;
    } else if (checkId || taskId === "check_apply") {
      const passage = passageOverride || scenePlain;
      userContent =
        checkMode === "apply" || taskId === "check_apply"
          ? `Apply this improvement plan. Change nothing else.

<plan>
${body.improvementPlan?.trim() || body.message?.trim() || "(none)"}
</plan>

<passage>
${passage}
</passage>`
          : `Run this single check. Return JSON only.

<passage>
${passage}
</passage>`;
    } else if (taskId === "analyze_density" || tellId) {
      const target = passageOverride || scenePlain || chapterPlain;
      userContent =
        body.scrubMode === "rewrite" && tellId
          ? `Rewrite this passage to remove ${tellId} only.\n\n<passage>\n${target}\n</passage>`
          : scrubUserMessage(target, tellId ?? undefined);
    } else {
      userContent = body.message?.trim() || scenePlain || "Help with this scene.";
    }

    const history = body.history ?? [];
    const messages: ChatMessage[] = [
      { role: "system", content: system },
      ...history.map((h) => ({ role: h.role, content: h.content })),
      { role: "user", content: userContent },
    ];

    const wantsJson =
      task.outputMode === "structured_json" &&
      body.scrubMode !== "rewrite" &&
      checkMode !== "apply" &&
      taskId !== "check_apply";

    if (wantsJson) {
      const text = await collectAgentText(
        runAgentLoop({
          model,
          temperature,
          messages,
          novelId: body.novelId,
          tools: undefined,
        }),
      );
      if (checkId) {
        let plan = parseImprovementPlan({}, checkId);
        try {
          plan = parseImprovementPlan(extractJsonObject(text), checkId);
        } catch {
          plan = { checkId, items: [] };
        }
        if (body.persist !== false) {
          const session = saveCoachSession({
            id: body.sessionId,
            novelId: body.novelId,
            sceneId: body.sceneId,
            chapterId,
            task: taskId,
            messagesJson: JSON.stringify([
              ...history,
              { role: "user", content: userContent },
              { role: "assistant", content: text },
            ]),
          });
          return Response.json({ plan, raw: text, sessionId: session.id });
        }
        return Response.json({ plan, raw: text });
      }
      if (taskId === "coach_physics") {
        let physics: unknown = {};
        try {
          physics = extractJsonObject(text);
        } catch {
          physics = {};
        }
        return Response.json({ physics, raw: text });
      }
      let hits = parseTellHits({});
      try {
        hits = parseTellHits(extractJsonObject(text));
      } catch {
        hits = [];
      }
      const thresholds = parseDensityThresholds(getSettings().densityThresholdsJson);
      const report = analyzePassageDensity(
        passageOverride || scenePlain || chapterPlain,
        hits,
        thresholds,
      );
      if (body.persist !== false) {
        const session = saveCoachSession({
          id: body.sessionId,
          novelId: body.novelId,
          sceneId: body.sceneId,
          chapterId,
          task: taskId,
          messagesJson: JSON.stringify([
            ...history,
            { role: "user", content: userContent },
            { role: "assistant", content: text },
          ]),
          densityJson: JSON.stringify(report),
        });
        return Response.json({ report, raw: text, sessionId: session.id });
      }
      return Response.json({ report, raw: text });
    }

    return agentSseResponse(async function* (signal) {
      let full = "";
      for await (const event of runAgentLoop({
        model,
        temperature,
        messages,
        novelId: body.novelId,
        tools: undefined,
        signal,
      })) {
        if (event.type === "token") full += event.text;
        if (event.type === "done") full = event.text || full;
        yield event;
      }
      if (body.persist !== false && full.trim()) {
        saveCoachSession({
          id: body.sessionId,
          novelId: body.novelId,
          sceneId: body.sceneId,
          chapterId,
          task: taskId,
          messagesJson: JSON.stringify([
            ...history,
            { role: "user", content: userContent },
            { role: "assistant", content: full.trim() },
          ]),
        });
      }
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 },
    );
  }
}
