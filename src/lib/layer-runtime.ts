import { systemPromptForTask, type AiTaskId } from "@/lib/ai-tasks";
import { PIPELINE_CONTINUE_NOTE } from "@/lib/prompts/pipeline";
import {
  collectAgentText,
  runAgentLoop,
  type AgentEvent,
  type ChatMessage,
} from "@/lib/openrouter";
import { resolveTaskRuntime } from "@/lib/task-runtime";

const LAYER_STEPS: Array<{ taskId: AiTaskId; label: string }> = [
  { taskId: "layer_brief", label: "Scene brief" },
  { taskId: "layer_dialogue", label: "Dialogue draft" },
  { taskId: "layer_prose", label: "Fill prose" },
  { taskId: "layer_climax", label: "Climax polish" },
];

export async function* runLayerPipeline(opts: {
  novelId: string;
  contextBlock: string;
  userInstruction: string;
  modelOverride?: string;
  signal: AbortSignal;
  streamFinal?: boolean;
  continuation?: boolean;
}): AsyncIterable<AgentEvent> {
  const streamFinal = opts.streamFinal !== false;
  const continueNote = opts.continuation ? `\n\n${PIPELINE_CONTINUE_NOTE}` : "";
  let prior = "";
  for (let i = 0; i < LAYER_STEPS.length; i++) {
    if (opts.signal.aborted) return;
    const step = LAYER_STEPS[i];
    const last = i === LAYER_STEPS.length - 1;
    yield { type: "status", message: `Layer ${i + 1}/${LAYER_STEPS.length}: ${step.label}` };
    const runtime = resolveTaskRuntime(step.taskId, opts.modelOverride);
    const messages: ChatMessage[] = [
      { role: "system", content: systemPromptForTask(step.taskId) },
      {
        role: "user",
        content: `${opts.contextBlock}${continueNote}

Author notes: ${opts.userInstruction.trim() || "(none)"}

${prior ? `Previous layer output:\n${prior}` : "No prior layer yet — start from the brief materials above."}`,
      },
    ];
    if (last && streamFinal) {
      let full = "";
      for await (const event of runAgentLoop({
        model: runtime.model,
        temperature: runtime.temperature,
        messages,
        novelId: opts.novelId,
        tools: undefined,
        signal: opts.signal,
      })) {
        if (event.type === "token") full += event.text;
        if (event.type === "done") full = event.text || full;
        yield event;
      }
      return;
    }
    prior = await collectAgentText(
      runAgentLoop({
        model: runtime.model,
        temperature: runtime.temperature,
        messages,
        novelId: opts.novelId,
        tools: undefined,
        signal: opts.signal,
      }),
    );
    if (last) yield { type: "done", text: prior };
  }
}
