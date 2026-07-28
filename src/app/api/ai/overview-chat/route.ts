import { COHERENCE_REVIEW_PROMPTS, QUESTION_BANK } from "@/lib/question-bank";
import {
  addOverviewMessage,
  getNovelTree,
  getSettings,
  listOverviewAnswers,
  listOverviewMessages,
} from "@/lib/novels";
import { OVERVIEW_SYSTEM_PROMPT } from "@/lib/prompts/rules";
import { runAgentLoop, sseEncode, type ChatMessage } from "@/lib/openrouter";
import { OVERVIEW_TOOLS } from "@/lib/tools";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      novelId: string;
      message: string;
      mode?: "fill" | "review";
      model?: string;
    };

    const settings = getSettings();
    const model = body.model || settings.defaultModel || "anthropic/claude-sonnet-4";
    const tree = getNovelTree(body.novelId);
    if (!tree) {
      return Response.json({ error: "Novel not found" }, { status: 404 });
    }

    addOverviewMessage(body.novelId, "user", body.message);
    const history = listOverviewMessages(body.novelId);
    const answers = listOverviewAnswers(body.novelId);

    const system = `${OVERVIEW_SYSTEM_PROMPT}

Question bank:
${QUESTION_BANK.map((q) => `- ${q.id}: ${q.prompt}`).join("\n")}
Coherence checks:
${COHERENCE_REVIEW_PROMPTS.map((p) => `- ${p}`).join("\n")}
Current mode preference: ${body.mode ?? "fill"}`;

    const messages: ChatMessage[] = [
      { role: "system", content: system },
      {
        role: "user",
        content: `Novel snapshot:\n${JSON.stringify(
          {
            novel: tree.novel,
            acts: tree.acts.map((a) => ({
              id: a.id,
              title: a.title,
              brief: a.brief,
              chapters: a.chapters.map((c) => ({
                id: c.id,
                title: c.title,
                goal: c.goal,
                beats: c.beats.map((b) => ({ id: b.id, content: b.content })),
                sceneCount: c.scenes.length,
              })),
            })),
            answers,
          },
          null,
          2,
        )}`,
      },
      ...history.slice(-20).map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ];

    const stream = new ReadableStream({
      async start(controller) {
        const enc = new TextEncoder();
        let full = "";
        try {
          for await (const event of runAgentLoop({
            model,
            temperature: 0.5,
            messages,
            tools: OVERVIEW_TOOLS,
            novelId: body.novelId,
          })) {
            if (event.type === "token") full += event.text;
            if (event.type === "done") {
              full = event.text || full;
              if (full.trim()) addOverviewMessage(body.novelId, "assistant", full.trim());
            }
            controller.enqueue(enc.encode(sseEncode(event)));
          }
        } catch (e) {
          controller.enqueue(
            enc.encode(
              sseEncode({
                type: "error",
                message: e instanceof Error ? e.message : "Overview chat failed",
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
