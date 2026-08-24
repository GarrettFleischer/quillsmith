import { AI_TASK_BY_ID, type AiTaskId } from "@/lib/ai-tasks";
import { getSettings } from "@/lib/novels";

/**
 * Resolve the model + temperature for an AI task.
 *
 * Model precedence: an explicitly requested model (e.g. an Action's own model)
 * → the global default model → the task's built-in default. Per-task model
 * overrides were removed; model selection now lives on Actions (blank = inherit
 * the global default).
 */
export function resolveTaskRuntime(taskId: AiTaskId, requestedModel?: string) {
  const def = AI_TASK_BY_ID[taskId];
  const settings = getSettings();
  return {
    model: requestedModel?.trim() || settings.defaultModel || def.defaultModel,
    temperature: def.temperature,
  };
}
