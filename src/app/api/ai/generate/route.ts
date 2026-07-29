import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { acts, beats, chapters, scenes } from "@/db/schema";
import {
  getCommand,
  getCommandOverride,
  getNovelTree,
  getSettings,
  listKnowledge,
  listOverviewAnswers,
  sceneBelongsToNovel,
} from "@/lib/novels";
import { knowledgeForSceneText } from "@/lib/mentions";
import { compileTemplate } from "@/lib/prompt";
import {
  buildCodex,
  buildNovelMeta,
  buildOutlineXml,
  buildSceneInstructions,
  buildVoiceAnchor,
} from "@/lib/prompts/context";
import { PROSE_SYSTEM_PROMPT, REWRITE_SYSTEM_PROMPT } from "@/lib/prompts/rules";
import { runAgentLoop, sseEncode, type ChatMessage } from "@/lib/openrouter";
import { PROSE_TOOLS } from "@/lib/tools";
import { plainFromTipTap } from "@/lib/utils";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      commandSlug: string;
      novelId: string;
      sceneId: string;
      instruction: string;
      model?: string;
      wordTarget?: number;
    };

    const settings = getSettings();
    const model = body.model || settings.defaultModel || "anthropic/claude-sonnet-4";
    const command = getCommand(body.commandSlug);
    if (!command) {
      return Response.json({ error: "Unknown command" }, { status: 400 });
    }

    const override = getCommandOverride(command.id, model);
    const temperature = override?.temperature ?? command.defaultTemperature;
    const template = override?.promptTemplate || command.promptTemplate;
    const enableTools = command.enableTools !== "false";
    const isRewrite =
      body.commandSlug === "rewrite" || body.commandSlug.startsWith("rewrite-");
    const isExpand =
      body.commandSlug === "expand" || body.commandSlug.startsWith("expand-");

    const db = getDb();
    const tree = getNovelTree(body.novelId);
    if (!tree || !sceneBelongsToNovel(body.sceneId, body.novelId)) {
      return Response.json({ error: "Novel or scene not found" }, { status: 404 });
    }
    const scene = db.select().from(scenes).where(eq(scenes.id, body.sceneId)).get()!;

    const chapter = db.select().from(chapters).where(eq(chapters.id, scene.chapterId)).get()!;
    const act = db.select().from(acts).where(eq(acts.id, chapter.actId)).get()!;
    const chapterBeats = db
      .select()
      .from(beats)
      .where(eq(beats.chapterId, chapter.id))
      .orderBy(asc(beats.order))
      .all();
    const siblingScenes = db
      .select()
      .from(scenes)
      .where(eq(scenes.chapterId, chapter.id))
      .orderBy(asc(scenes.order))
      .all();
    const idx = siblingScenes.findIndex((s) => s.id === scene.id);
    const prev = siblingScenes[idx - 1];
    const next = siblingScenes[idx + 1];

    const currentPlain = plainFromTipTap(scene.content);
    const kb = knowledgeForSceneText(body.novelId, currentPlain + " " + body.instruction);
    const answers = listOverviewAnswers(body.novelId);
    const allKnowledge = listKnowledge(body.novelId);

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
    const taskLead = isExpand
      ? wordTarget
        ? `Write up to about ${wordTarget} words that continue the story, using the following instructions. Stop early if the beats are covered sooner:`
        : `Continue the story using the following instructions. Stop once the beats are covered; never pad:`
      : wordTarget
        ? `Condense the current scene to about ${wordTarget} words:`
        : `Condense the current scene:`;

    const bag = {
      userInstruction: body.instruction,
      lengthInstructions,
      taskLead,
      sceneInstructions: buildSceneInstructions({
        chapterBeats,
        userInstruction: body.instruction,
        answers,
        sceneTitle: scene.title,
        hasExistingProse: Boolean(currentPlain.trim()),
      }),
      codex: buildCodex(allKnowledge),
      outline: buildOutlineXml(tree),
      novelMeta: buildNovelMeta(tree, answers),
      currentScene: currentPlain,
      voiceAnchor: buildVoiceAnchor(currentPlain, prev ? plainFromTipTap(prev.content) : ""),
      previousScene: prev ? plainFromTipTap(prev.content) : "",
      nextScene: next
        ? plainFromTipTap(next.content) ||
          `(untitled next scene${next.title ? `: ${next.title}` : ""} - do not write this yet)`
        : "(none - do not invent a following scene)",
      chapterText: siblingScenes.map((s) => plainFromTipTap(s.content)).join("\n\n"),
      chapterBeats: chapterBeats.map((b, i) => `${i + 1}. ${b.content}`).join("\n"),
      chapterGoal: chapter.goal ?? "",
      chapterTitle: chapter.title,
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
      knowledge: kb
        .map((e) => `- ${e.name} (${e.type}): ${e.summary}`)
        .join("\n"),
    };

    const prompt = compileTemplate(template, bag);
    const systemPrompt = isRewrite
      ? compileTemplate(REWRITE_SYSTEM_PROMPT, { lengthInstructions })
      : PROSE_SYSTEM_PROMPT;
    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt },
    ];

    const stream = new ReadableStream({
      async start(controller) {
        const enc = new TextEncoder();
        try {
          for await (const event of runAgentLoop({
            model,
            temperature,
            messages,
            tools: enableTools ? PROSE_TOOLS : undefined,
            novelId: body.novelId,
          })) {
            controller.enqueue(enc.encode(sseEncode(event)));
          }
        } catch (e) {
          controller.enqueue(
            enc.encode(
              sseEncode({
                type: "error",
                message: e instanceof Error ? e.message : "Generation failed",
              }),
            ),
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 },
    );
  }
}
