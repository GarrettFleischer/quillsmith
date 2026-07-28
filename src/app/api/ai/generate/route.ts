import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { acts, beats, chapters, scenes } from "@/db/schema";
import {
  getCommand,
  getCommandOverride,
  getNovel,
  getSettings,
} from "@/lib/novels";
import { knowledgeForSceneText } from "@/lib/mentions";
import { compileTemplate } from "@/lib/prompt";
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
    const enableTools = (override ? true : command.enableTools !== "false");

    const db = getDb();
    const novel = getNovel(body.novelId);
    const scene = db.select().from(scenes).where(eq(scenes.id, body.sceneId)).get();
    if (!novel || !scene) {
      return Response.json({ error: "Novel or scene not found" }, { status: 404 });
    }

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
    const bag = {
      userInstruction: body.instruction,
      currentScene: currentPlain,
      previousScene: prev ? plainFromTipTap(prev.content) : "",
      nextScene: next ? plainFromTipTap(next.content) : "",
      chapterText: siblingScenes.map((s) => plainFromTipTap(s.content)).join("\n\n"),
      chapterBeats: chapterBeats.map((b, i) => `${i + 1}. ${b.content}`).join("\n"),
      chapterGoal: chapter.goal ?? "",
      actTitle: act.title,
      actBrief: [
        act.brief,
        act.introduces && `Introduces: ${act.introduces}`,
        act.accomplishes && `Accomplishes: ${act.accomplishes}`,
        act.losses && `Losses: ${act.losses}`,
      ]
        .filter(Boolean)
        .join("\n"),
      novelPremise: novel.premise ?? "",
      knowledge: kb
        .map((e) => `- ${e.name} (${e.type}): ${e.summary}`)
        .join("\n"),
    };

    const prompt = compileTemplate(template, bag);
    const messages: ChatMessage[] = [
      {
        role: "system",
        content:
          "You are Quillsmith's prose assistant. Prefer tools when lore or prior drafts may help. Final answer must be story prose only.",
      },
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
