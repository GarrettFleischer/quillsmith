import { systemPromptForTask, type AiTaskId } from "@/lib/ai-tasks";
import { CHECKS, parseImprovementPlan, type CheckId } from "@/lib/checks";
import { runLayerPipeline } from "@/lib/layer-runtime";
import {
  collectAgentText,
  extractJsonObject,
  runAgentLoop,
  type AgentEvent,
  type ChatMessage,
} from "@/lib/openrouter";
import { checkApplySystem, checkPlanSystem } from "@/lib/prompts/checks";
import { appendStyleGuide } from "@/lib/prompts/style-guide";
import { resolveTaskRuntime } from "@/lib/task-runtime";
import { resolveWritingStyleGuide } from "@/lib/writing-style";
import { getNovel } from "@/lib/novels";

export type KnowledgeLite = {
  id: string;
  type: string;
  name: string;
  aliases?: string | null;
  summary?: string | null;
  slidersJson?: string | null;
};

export function asProse(text: string): string {
  let t = text.trim();
  const fenced = t.match(/^```(?:\w+)?\s*([\s\S]*?)```$/);
  if (fenced?.[1]) t = fenced[1].trim();
  return t;
}

export async function* yieldProse(
  text: string,
  apply: "append" | "replace" = "append",
): AsyncIterable<AgentEvent> {
  const clean = asProse(text);
  const size = 280;
  for (let i = 0; i < clean.length; i += size) {
    yield { type: "token", text: clean.slice(i, i + size) };
  }
  yield { type: "done", text: clean, apply };
}

async function jsonCall(opts: {
  taskId: AiTaskId;
  novelId: string;
  system: string;
  user: string;
  signal: AbortSignal;
}): Promise<unknown> {
  const runtime = resolveTaskRuntime(opts.taskId);
  const messages: ChatMessage[] = [
    { role: "system", content: opts.system },
    { role: "user", content: opts.user },
  ];
  const text = await collectAgentText(
    runAgentLoop({
      model: runtime.model,
      temperature: runtime.temperature,
      messages,
      novelId: opts.novelId,
      tools: undefined,
      signal: opts.signal,
    }),
  );
  try {
    return extractJsonObject(text);
  } catch {
    return {};
  }
}

export function pickCuratedEntries(
  all: KnowledgeLite[],
  mention: KnowledgeLite[],
  names: string[],
  cap = 12,
): KnowledgeLite[] {
  const out: KnowledgeLite[] = [];
  const seen = new Set<string>();
  const add = (entry: KnowledgeLite | undefined) => {
    if (!entry || seen.has(entry.id) || out.length >= cap) return;
    seen.add(entry.id);
    out.push(entry);
  };
  for (const entry of mention) add(entry);
  const lowered = names.map((n) => n.trim().toLowerCase()).filter(Boolean);
  for (const name of lowered) {
    const match = all.find((e) => {
      if (e.name.toLowerCase() === name) return true;
      return (e.aliases ?? "")
        .split(",")
        .map((a) => a.trim().toLowerCase())
        .includes(name);
    });
    add(match);
  }
  return out.length ? out : mention;
}

export async function curateSceneEntries(opts: {
  novelId: string;
  all: KnowledgeLite[];
  mention: KnowledgeLite[];
  scenePack: string;
  signal: AbortSignal;
}): Promise<KnowledgeLite[]> {
  if (opts.all.length === 0) return [];
  const catalog = opts.all
    .map(
      (e) =>
        `- [${e.type}] ${e.name}${e.aliases ? ` (${e.aliases})` : ""}: ${(e.summary ?? "").slice(0, 220)}`,
    )
    .join("\n");
  const raw = await jsonCall({
    taskId: "curate_context",
    novelId: opts.novelId,
    system: systemPromptForTask("curate_context"),
    user: `Scene materials:\n${opts.scenePack}\n\nLore catalog:\n${catalog || "(empty)"}`,
    signal: opts.signal,
  });
  const names = Array.isArray((raw as { entryNames?: unknown }).entryNames)
    ? (raw as { entryNames: unknown[] }).entryNames.map((n) => String(n))
    : [];
  return pickCuratedEntries(opts.all, opts.mention, names);
}

export async function proposeScenePhysics(opts: {
  novelId: string;
  characters: KnowledgeLite[];
  scenePack: string;
  signal: AbortSignal;
}): Promise<unknown> {
  const names = opts.characters
    .filter((e) => e.type === "character")
    .map((e) => `- ${e.name}${e.aliases ? ` (${e.aliases})` : ""}`)
    .join("\n");
  return jsonCall({
    taskId: "coach_physics",
    novelId: opts.novelId,
    system: systemPromptForTask("coach_physics"),
    user: `Characters:\n${names || "(none)"}\n\nScene materials:\n${opts.scenePack}`,
    signal: opts.signal,
  });
}

export async function* runCheckSeries(opts: {
  novelId: string;
  passage: string;
  signal: AbortSignal;
}): AsyncGenerator<AgentEvent, string> {
  let text = asProse(opts.passage);
  if (!text.trim()) return text;
  for (const check of CHECKS) {
    if (opts.signal.aborted) return text;
    yield { type: "status", message: `Check: ${check.label} — planning` };
    const planRaw = await jsonCall({
      taskId: `check_${check.id}` as AiTaskId,
      novelId: opts.novelId,
      system: checkPlanSystem(check.id as CheckId),
      user: `Run this single check. Return JSON only.\n\n<passage>\n${text}\n</passage>`,
      signal: opts.signal,
    });
    const plan = parseImprovementPlan(planRaw, check.id);
    if (plan.items.length === 0) {
      yield { type: "status", message: `Check: ${check.label} — clean` };
      continue;
    }
    yield {
      type: "status",
      message: `Check: ${check.label} — applying ${plan.items.length} item(s)`,
    };
    const runtime = resolveTaskRuntime("check_apply");
    const styleGuide = resolveWritingStyleGuide(getNovel(opts.novelId)?.styleGuideJson);
    const applied = await collectAgentText(
      runAgentLoop({
        model: runtime.model,
        temperature: runtime.temperature,
        messages: [
          { role: "system", content: appendStyleGuide(checkApplySystem(), styleGuide) },
          {
            role: "user",
            content: `Apply this improvement plan. Change nothing else.\n\n<plan>\n${JSON.stringify(plan)}\n</plan>\n\n<passage>\n${text}\n</passage>`,
          },
        ],
        novelId: opts.novelId,
        tools: undefined,
        signal: opts.signal,
      }),
    );
    const next = asProse(applied);
    if (next) text = next;
  }
  return text;
}

export async function* runProsePipeline(opts: {
  novelId: string;
  contextBlock: string;
  userInstruction: string;
  continuation: boolean;
  signal: AbortSignal;
}): AsyncIterable<AgentEvent> {
  let draft = "";
  for await (const event of runLayerPipeline({
    novelId: opts.novelId,
    contextBlock: opts.contextBlock,
    userInstruction: opts.userInstruction,
    signal: opts.signal,
    streamFinal: false,
    continuation: opts.continuation,
  })) {
    if (event.type === "done") {
      draft = event.text;
      continue;
    }
    yield event;
  }
  if (opts.signal.aborted) return;
  const checks = runCheckSeries({
    novelId: opts.novelId,
    passage: draft,
    signal: opts.signal,
  });
  let cleaned = draft;
  while (true) {
    const step = await checks.next();
    if (step.done) {
      cleaned = step.value || draft;
      break;
    }
    yield step.value;
  }
  yield { type: "status", message: "Draft ready" };
  yield* yieldProse(cleaned, "append");
}
