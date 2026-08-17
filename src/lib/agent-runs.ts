import { id } from "@/lib/utils";

const TTL_MS = 10 * 60 * 1000;

type Run = {
  controller: AbortController;
  createdAt: number;
};

const runs = new Map<string, Run>();

function sweep() {
  const cutoff = Date.now() - TTL_MS;
  for (const [runId, run] of runs) {
    if (run.createdAt < cutoff) {
      run.controller.abort();
      runs.delete(runId);
    }
  }
}

export function createRun() {
  sweep();
  const runId = id();
  const controller = new AbortController();
  runs.set(runId, { controller, createdAt: Date.now() });
  return { runId, signal: controller.signal };
}

export function stopRun(runId: string) {
  const run = runs.get(runId);
  if (!run) return false;
  run.controller.abort();
  return true;
}

export function finishRun(runId: string) {
  runs.delete(runId);
}
