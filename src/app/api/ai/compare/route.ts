import { AI_TASK_BY_ID, isAiTaskId, systemPromptForTask, type AiTaskId } from "@/lib/ai-tasks";
import { collectAgentText, runAgentLoop, type ChatMessage } from "@/lib/openrouter";
import { resolveTaskRuntime } from "@/lib/task-runtime";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      novelId: string;
      task?: string;
      prompt: string;
      models: string[];
    };
    if (!body.prompt?.trim()) {
      return Response.json({ error: "Prompt required" }, { status: 400 });
    }
    const models = (body.models ?? []).map((m) => m.trim()).filter(Boolean).slice(0, 3);
    if (models.length < 2) {
      return Response.json({ error: "Provide 2–3 model ids" }, { status: 400 });
    }
    const taskId: AiTaskId =
      body.task && isAiTaskId(body.task) ? body.task : "compare_models";
    const def = AI_TASK_BY_ID[taskId];
    const system = systemPromptForTask(taskId);
    const runtime = resolveTaskRuntime(taskId);

    const results = [];
    for (const model of models) {
      const messages: ChatMessage[] = [
        { role: "system", content: system },
        { role: "user", content: body.prompt },
      ];
      const text = await collectAgentText(
        runAgentLoop({
          model,
          temperature: runtime.temperature ?? def.temperature,
          messages,
          novelId: body.novelId || "settings",
          tools: undefined,
        }),
      );
      results.push({ model, text });
    }
    return Response.json({ results });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 },
    );
  }
}
