import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { acts, beats, chapters, scenes } from "@/db/schema";
import {
  AI_TASK_BY_ID,
  commandKind,
  commandSlugToTask,
  systemPromptForTask,
  toolsForTask,
} from "@/lib/ai-tasks";
import { CHECK_BY_ID, checkIdFromSlug } from "@/lib/checks";
import { runLayerPipeline } from "@/lib/layer-runtime";
import {
  getCommand,
  getCommandOverride,
  getNovelTree,
  getSettings,
  getChapterProse,
  listKnowledge,
  listOverviewAnswers,
  sceneBelongsToNovel,
  chapterBelongsToNovel,
  updateSceneSliders,
} from "@/lib/novels";
import { knowledgeForSceneText } from "@/lib/mentions";
import { compileTemplate } from "@/lib/prompt";
import {
  buildCodex,
  buildCurrentActOutline,
  buildNovelMeta,
  buildOutlineXml,
  buildSceneInstructions,
  buildSlidersBlock,
  buildStorySoFar,
  buildStyleGuideBlock,
  buildVoiceAnchor,
  sceneMatchText,
} from "@/lib/prompts/context";
import { CHECK_APPLY_TEMPLATE, EXPAND_TEMPLATE } from "@/lib/prompts/templates";
import {
  curateSceneEntries,
  proposeScenePhysics,
  runCheckSeries,
  runProsePipeline,
  yieldProse,
} from "@/lib/prose-pipeline";
import {
  agentSseResponse,
  collectAgentText,
  CONTEXT_SOFT_CAP_TOKENS,
  CONTEXT_WARN_TOKENS,
  estimateTokens,
  runAgentLoop,
  type AgentEvent,
  type ChatMessage,
} from "@/lib/openrouter";
import {
  mergePhysicsProposal,
  parseSceneSliders,
  sceneHasPhysics,
  stringifySceneSliders,
  type PhysicsProposal,
} from "@/lib/sliders";
import { resolveTaskRuntime } from "@/lib/task-runtime";
import { plainFromTipTap } from "@/lib/utils";

export const runtime = "nodejs";

function clip(text: string, max = 3000): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n…`;
}

function contextStatus(tokenEstimate: number): AgentEvent | null {
  if (tokenEstimate >= CONTEXT_SOFT_CAP_TOKENS) {
    return {
      type: "status",
      message: `Context is over ~50k tokens (~${tokenEstimate}). Trim distant prose; quality drops when the model has to hunt.`,
    };
  }
  if (tokenEstimate >= CONTEXT_WARN_TOKENS) {
    return {
      type: "status",
      message: `Context is large (~${tokenEstimate} tokens). Prefer chapter summaries over dumping distant prose.`,
    };
  }
  return null;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      commandSlug: string;
      novelId: string;
      sceneId?: string;
      chapterId?: string;
      instruction: string;
      selection?: string;
      model?: string;
      wordTarget?: number;
      scrubMode?: "identify" | "rewrite";
      checkMode?: "plan" | "apply";
      improvementPlan?: string;
    };

    const command = getCommand(body.commandSlug);
    if (!command) {
      return Response.json({ error: "Unknown command" }, { status: 400 });
    }

    const taskId = commandSlugToTask(body.commandSlug);
    const task = taskId ? AI_TASK_BY_ID[taskId] : null;
    const kind = commandKind(body.commandSlug);
    const checkId = checkIdFromSlug(body.commandSlug);
    const checkMode = body.checkMode ?? (kind === "check" ? "plan" : undefined);
    const settings = getSettings();
    const craftOn = settings.craftPipeline !== false;

    const runtimeTaskId =
      kind === "check" && checkMode === "apply"
        ? "check_apply"
        : kind === "layer"
          ? "layer_brief"
          : taskId;
    const runtime = runtimeTaskId
      ? resolveTaskRuntime(runtimeTaskId, body.model)
      : {
          model: body.model || settings.defaultModel || "anthropic/claude-sonnet-4",
          temperature: command.defaultTemperature,
        };

    const override = getCommandOverride(command.id, runtime.model);
    const temperature = override?.temperature ?? runtime.temperature;
    const enableTools = command.enableTools !== "false" && kind !== "check";
    const model = runtime.model;

    const db = getDb();
    const tree = getNovelTree(body.novelId);
    const proseId =
      body.sceneId ||
      (body.chapterId ? getChapterProse(body.chapterId)?.id : undefined);
    if (!tree || !proseId || !sceneBelongsToNovel(proseId, body.novelId)) {
      return Response.json({ error: "Novel or chapter not found" }, { status: 404 });
    }
    if (body.chapterId && !chapterBelongsToNovel(body.chapterId, body.novelId)) {
      return Response.json({ error: "Chapter not found" }, { status: 404 });
    }
    const scene = db.select().from(scenes).where(eq(scenes.id, proseId)).get()!;

    const chapter = db.select().from(chapters).where(eq(chapters.id, scene.chapterId)).get()!;
    const act = db.select().from(acts).where(eq(acts.id, chapter.actId)).get()!;
    const chapterBeats = db
      .select()
      .from(beats)
      .where(eq(beats.chapterId, chapter.id))
      .orderBy(asc(beats.order))
      .all();
    const ordered = tree.acts.flatMap((a) =>
      a.chapters.map((c) => ({ act: a, chapter: c })),
    );
    const idx = ordered.findIndex((row) => row.chapter.id === chapter.id);
    const prevChapter = idx > 0 ? ordered[idx - 1]?.chapter : undefined;
    const nextChapter = idx >= 0 ? ordered[idx + 1]?.chapter : undefined;
    const prevProse = prevChapter?.prose ?? prevChapter?.scenes[0];
    const nextProse = nextChapter?.prose ?? nextChapter?.scenes[0];

    const currentPlain = plainFromTipTap(scene.content);
    const matchText = sceneMatchText([
      scene.title,
      chapter.title,
      chapter.goal,
      body.instruction,
      currentPlain,
      ...chapterBeats.map((b) => b.content),
    ]);
    const mentionKb = knowledgeForSceneText(
      body.novelId,
      sceneMatchText([matchText, body.selection]),
    );
    const allKnowledge = listKnowledge(body.novelId);
    const answers = listOverviewAnswers(body.novelId);
    const previousPlain = prevProse ? clip(plainFromTipTap(prevProse.content)) : "";
    const nextPlain = nextProse ? clip(plainFromTipTap(nextProse.content)) : "";

    const parsedWords =
      typeof body.wordTarget === "number" && body.wordTarget > 0
        ? body.wordTarget
        : (() => {
            const m = body.instruction.match(/\b(\d{2,5})\s*words?\b/i);
            return m ? Number(m[1]) : undefined;
          })();
    const wordTarget =
      typeof parsedWords === "number" && Number.isFinite(parsedWords) && parsedWords > 0
        ? parsedWords
        : undefined;
    const lengthInstructions = (() => {
      const trimmed = body.instruction.trim();
      if (wordTarget && trimmed && !/\b\d{2,5}\s*words?\b/i.test(trimmed)) {
        return `${wordTarget} words. ${trimmed}`;
      }
      if (wordTarget) return `${wordTarget} words`;
      if (trimmed) return trimmed;
      return "noticeably shorter while preserving all meaning";
    })();
    const taskLead =
      kind === "layer" || (kind === "expand" && craftOn)
        ? "Produce this layer of the chapter from the materials below."
        : kind === "expand"
          ? wordTarget
            ? `Write up to about ${wordTarget} words that continue the story, using the following instructions. Stop early if the beats are covered sooner:`
            : `Continue the story using the following instructions. Stop once the beats are covered; never pad:`
          : wordTarget
            ? `Condense the current chapter to about ${wordTarget} words:`
            : `Condense the current chapter:`;

    const styleGuide = buildStyleGuideBlock(tree.novel.styleGuideJson);

    const buildBag = (
      kb: Array<{
        id: string;
        type: string;
        name: string;
        aliases?: string | null;
        summary?: string | null;
        slidersJson?: string | null;
      }>,
      slidersJson: string | null | undefined,
    ) => ({
      userInstruction: body.instruction,
      lengthInstructions,
      taskLead,
      styleGuide,
      sliders: buildSlidersBlock({ sceneSlidersJson: slidersJson, entries: kb }),
      checkFocus: checkId ? CHECK_BY_ID[checkId].focus : "",
      improvementPlan: body.improvementPlan?.trim() || body.instruction.trim() || "(none)",
      sceneInstructions: buildSceneInstructions({
        chapterBeats,
        userInstruction: body.instruction,
        answers,
        sceneTitle: chapter.title,
        hasExistingProse: Boolean(currentPlain.trim()),
      }),
      codex: buildCodex(kb),
      mentionedCodex: buildCodex(mentionKb),
      outline: buildOutlineXml(tree),
      storySoFar: buildStorySoFar(tree, chapter.id),
      currentActOutline: buildCurrentActOutline(tree, act.title),
      novelMeta: buildNovelMeta(tree, answers),
      currentScene: currentPlain,
      currentChapter: currentPlain,
      voiceAnchor: buildVoiceAnchor(currentPlain, previousPlain),
      previousScene: previousPlain,
      previousChapter: previousPlain,
      nextScene: nextPlain || "(none - do not invent a following chapter)",
      nextChapter: nextPlain
        ? nextPlain ||
          `(next chapter${nextChapter?.title ? `: ${nextChapter.title}` : ""} - do not write this yet)`
        : "(none - do not invent a following chapter)",
      chapterText: currentPlain,
      chapterBeats: chapterBeats.map((b, i) => `${i + 1}. ${b.content}`).join("\n"),
      chapterSummary: chapter.summary ?? "",
      chapterGoal: chapter.goal ?? "",
      chapterTitle: chapter.title,
      selection: body.selection?.trim() || "",
      actTitle: act.title,
      actBrief: [
        act.brief,
        act.introduces && `Introduces: ${act.introduces}`,
        act.accomplishes && `Accomplishes: ${act.accomplishes}`,
        act.losses && `Losses: ${act.losses}`,
      ]
        .filter(Boolean)
        .join("\n"),
      novelPremise: tree.novel.premise ?? "",
      knowledge: kb.map((e) => `- ${e.name} (${e.type}): ${e.summary}`).join("\n"),
    });

    const scenePack = sceneMatchText([
      `Act: ${act.title}`,
      `Chapter: ${chapter.title}`,
      chapter.goal,
      ...chapterBeats.map((b) => b.content),
      body.instruction,
      currentPlain.slice(0, 4000),
    ]);

    const useDraftPipeline = craftOn && (kind === "expand" || kind === "layer");
    const useRewriteChecks = craftOn && kind === "rewrite";

    const template =
      kind === "check" && checkMode === "apply"
        ? CHECK_APPLY_TEMPLATE
        : override?.promptTemplate || command.promptTemplate;

    const tools = task ? toolsForTask(task) : enableTools ? toolsForTask(AI_TASK_BY_ID.prose_expand) : undefined;

    return agentSseResponse(async function* (signal) {
      let kb: Array<{
        id: string;
        type: string;
        name: string;
        aliases?: string | null;
        summary?: string | null;
        slidersJson?: string | null;
      }> = mentionKb;
      let slidersJson = scene.slidersJson;

      if (useDraftPipeline) {
        yield { type: "status", message: "Curating scene context" };
        kb = await curateSceneEntries({
          novelId: body.novelId,
          all: allKnowledge,
          mention: mentionKb,
          scenePack,
          signal,
        });
        const parsed = parseSceneSliders(slidersJson);
        if (!sceneHasPhysics(parsed)) {
          yield { type: "status", message: "Setting narrative physics for this scene" };
          const physics = (await proposeScenePhysics({
            novelId: body.novelId,
            characters: allKnowledge,
            scenePack,
            signal,
          })) as PhysicsProposal;
          const merged = mergePhysicsProposal(
            parsed,
            physics,
            allKnowledge.filter((e) => e.type === "character"),
          );
          if (sceneHasPhysics(merged)) {
            slidersJson = stringifySceneSliders(merged);
            updateSceneSliders(proseId, body.novelId, slidersJson);
          }
        }
      }

      const bag = buildBag(kb, slidersJson);
      const prompt = compileTemplate(useDraftPipeline ? EXPAND_TEMPLATE : template, bag);
      const tokenEstimate = estimateTokens(prompt);
      const warn = contextStatus(tokenEstimate);
      if (warn) yield warn;

      if (useDraftPipeline) {
        yield* runProsePipeline({
          novelId: body.novelId,
          contextBlock: prompt,
          userInstruction: body.instruction,
          continuation: Boolean(currentPlain.trim()),
          signal,
        });
        return;
      }

      let systemPrompt = taskId
        ? systemPromptForTask(kind === "layer" ? "layer_brief" : taskId, {
            scrubMode: body.scrubMode ?? "identify",
            checkId: checkId ?? undefined,
            checkMode,
          })
        : kind === "rewrite"
          ? compileTemplate(systemPromptForTask("prose_rewrite"), { lengthInstructions })
          : systemPromptForTask("prose_expand");
      if (kind === "rewrite") {
        systemPrompt = compileTemplate(systemPrompt, { lengthInstructions });
      }
      if (styleGuide && kind === "expand") {
        systemPrompt = `${systemPrompt}\n\n${styleGuide}`;
      }

      const messages: ChatMessage[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ];

      if (kind === "layer") {
        yield* runLayerPipeline({
          novelId: body.novelId,
          contextBlock: prompt,
          userInstruction: body.instruction,
          signal,
          continuation: Boolean(currentPlain.trim()),
        });
        return;
      }

      if (useRewriteChecks) {
        yield { type: "status", message: "Condensing…" };
        const raw = await collectAgentText(
          runAgentLoop({
            model,
            temperature,
            messages,
            tools: undefined,
            novelId: body.novelId,
            signal,
          }),
        );
        const checks = runCheckSeries({
          novelId: body.novelId,
          passage: raw,
          signal,
        });
        let cleaned = raw;
        while (true) {
          const step = await checks.next();
          if (step.done) {
            cleaned = step.value || raw;
            break;
          }
          yield step.value;
        }
        yield* yieldProse(cleaned, "replace");
        return;
      }

      yield* runAgentLoop({
        model,
        temperature,
        messages,
        tools: enableTools ? tools : undefined,
        novelId: body.novelId,
        signal,
      });
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 },
    );
  }
}
