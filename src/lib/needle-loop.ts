import {
  collectAgentText,
  runAgentLoop,
  type AgentEvent,
  type ChatMessage,
} from "@/lib/openrouter";
import { executeTool, type ToolDef } from "@/lib/tools";
import { needleComplete } from "@/lib/needle";

function clip(text: string, max = 80) {
  const compact = text.replace(/\s+/g, " ").trim();
  return compact.length <= max ? compact : `${compact.slice(0, max - 1)}…`;
}

const PLANNER_PROMPT = `You are planning edits to the novel (its outline, chapters, and story bible), but you do NOT call tools yourself.
On each turn output EXACTLY ONE line, either:
- a single imperative sentence describing the ONE next action to take, phrased plainly with its content inline (e.g. "Set the chapter summary to: <text>" or "Add a beat: <sentence>"), or
- "DONE: <one short sentence>" when the user's request is fully handled.
Do ONLY what the user asked — do not invent extra actions. Take one concrete action at a time. As soon as the user's request has been carried out, reply "DONE:" — never repeat, rephrase, or pad with actions they did not request. Do not number steps, do not explain, output only the single line.`;

/**
 * Needle-mediated agent loop: the big model (via OpenRouter) reasons and
 * describes ONE next action in natural language; the local Needle 2 model
 * turns that description into a concrete tool call, which we execute and feed
 * back. Yields the same AgentEvents as `runAgentLoop` so the SSE plumbing and
 * the client are unchanged.
 */
export async function* runNeedleLoop(opts: {
  model: string;
  temperature: number;
  messages: ChatMessage[];
  tools?: ToolDef[];
  novelId: string;
  chapterId?: string;
  signal?: AbortSignal;
}): AsyncGenerator<AgentEvent> {
  const tools = opts.tools ?? [];
  const messages: ChatMessage[] = [...opts.messages];
  const planner: ChatMessage = { role: "system", content: PLANNER_PROMPT };
  const MAX_ROUNDS = 8;
  let finalText = "";
  let lastLine = "";

  for (let round = 0; round < MAX_ROUNDS; round++) {
    if (opts.signal?.aborted) break;

    yield { type: "status", message: round === 0 ? "Planning…" : "Planning next step…" };

    let line = "";
    try {
      line = (
        await collectAgentText(
          runAgentLoop({
            model: opts.model,
            temperature: opts.temperature,
            messages: [...messages, planner],
            tools: undefined,
            novelId: opts.novelId,
            chapterId: opts.chapterId,
            signal: opts.signal,
          }),
        )
      ).trim();
    } catch (e) {
      yield { type: "error", message: e instanceof Error ? e.message : "Planner failed" };
      return;
    }

    if (!line) break;
    // Only the first line is the action; drop any accidental extra prose.
    line = line.split("\n")[0].trim();
    yield { type: "thinking", text: line };

    const doneMatch = /^done\b[:.\-\s]*/i.exec(line);
    if (doneMatch) {
      finalText = line.slice(doneMatch[0].length).trim();
      break;
    }

    // Convergence guard: a weak planner sometimes re-issues the action it just
    // performed instead of saying DONE — treat a repeat as completion.
    if (line.toLowerCase() === lastLine.toLowerCase()) {
      finalText = finalText || "Done.";
      break;
    }

    yield { type: "status", message: "Needle: choosing the tool call…" };
    const nd = await needleComplete(tools, line, { signal: opts.signal });
    if (nd.error) {
      yield { type: "error", message: nd.error };
      return;
    }
    // One plan line = one action: execute only the first call Needle returns,
    // so it can't fan a single description out into extra (e.g. rewrite) calls.
    const call = nd.functionCalls[0];
    if (!call) {
      finalText = line;
      break;
    }

    const argsPreview = clip(JSON.stringify(call.arguments ?? {}));
    const conf = nd.confidence != null ? ` · conf ${nd.confidence.toFixed(3)}` : "";
    yield { type: "tool", name: call.name, phase: "start", args: `${argsPreview}${conf}` };
    const result = await executeTool(call.name, call.arguments ?? {}, {
      novelId: opts.novelId,
      chapterId: opts.chapterId,
    });
    yield { type: "tool", name: call.name, phase: "done", preview: clip(JSON.stringify(result)) };

    if (
      call.name === "propose_chapter_rewrite" &&
      result &&
      typeof result === "object" &&
      "text" in result &&
      typeof (result as { text?: unknown }).text === "string"
    ) {
      const text = String((result as { text: string }).text).trim();
      const apply = (result as { apply?: string }).apply === "append" ? "append" : "replace";
      if (text) yield { type: "draft", text, apply };
    }

    lastLine = line;
    messages.push({ role: "assistant", content: line });
    messages.push({
      role: "user",
      content: `Done: ${call.name} was executed and saved. If the user's request is now fully handled, reply "DONE: <short confirmation>". Otherwise give the next single action.`,
    });
  }

  yield { type: "done", text: finalText || "Done." };
}
