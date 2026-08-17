import { AI_TASK_BY_ID, type AiTaskId } from "@/lib/ai-tasks";
import { getSettings, getTaskOverride } from "@/lib/novels";

export function resolveTaskRuntime(taskId: AiTaskId, requestedModel?: string) {
  const def = AI_TASK_BY_ID[taskId];
  const settings = getSettings();
  const override = getTaskOverride(taskId);
  return {
    model:
      requestedModel?.trim() ||
      override?.modelId ||
      settings.defaultModel ||
      def.defaultModel,
    temperature: override?.temperature ?? def.temperature,
  };
}
