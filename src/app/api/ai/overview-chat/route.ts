import { COHERENCE_REVIEW_PROMPTS, QUESTION_BANK } from "@/lib/question-bank";
import {
  addOverviewMessage,
  getNovelTree,
  listOverviewAnswers,
  listOverviewMessages,
} from "@/lib/novels";
import { systemPromptForTask, toolsForTask, AI_TASK_BY_ID } from "@/lib/ai-tasks";
import { agentSseResponse, runAgentLoop, type ChatMessage } from "@/lib/openrouter";
import { resolveTaskRuntime } from "@/lib/task-runtime";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      novelId: string;
      message: string;
      mode?: "fill" | "review";
      model?: string;
    };

    const taskId = body.mode === "review" ? "overview_review" : "overview_fill";
    const task = AI_TASK_BY_ID[taskId];
    const { model, temperature } = resolveTaskRuntime(taskId, body.model);
    const tree = getNovelTree(body.novelId);
    if (!tree) {
      return Response.json({ error: "Novel not found" }, { status: 404 });
    }

    addOverviewMessage(body.novelId, "user", body.message);
    const history = listOverviewMessages(body.novelId);
    const answers = listOverviewAnswers(body.novelId);

    const system = `${systemPromptForTask(taskId)}

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
              summary: a.summary,
              chapters: a.chapters.map((c) => ({
                id: c.id,
                title: c.title,
                goal: c.goal,
                summary: c.summary,
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

    return agentSseResponse(async function* (signal) {
      let full = "";
      for await (const event of runAgentLoop({
        model,
        temperature,
        messages,
        tools: toolsForTask(task),
        novelId: body.novelId,
        signal,
      })) {
        if (event.type === "token") full += event.text;
        if (event.type === "done") {
          full = event.text || full;
          if (full.trim()) addOverviewMessage(body.novelId, "assistant", full.trim());
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
