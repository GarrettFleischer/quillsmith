import { executeTool, type ToolDef } from "@/lib/tools";
import { getSettings } from "@/lib/novels";
import { createRun, finishRun } from "@/lib/agent-runs";

export type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
};

export type AgentEvent =
  | { type: "run"; id: string }
  | { type: "status"; message: string }
  | { type: "thinking"; text: string }
  | { type: "token"; text: string }
  | {
      type: "tool";
      name: string;
      phase: "start" | "done";
      args?: string;
      preview?: string;
    }
  | { type: "done"; text: string; apply?: "append" | "replace" }
  | { type: "error"; message: string };

type ToolCallAcc = { id: string; name: string; arguments: string };

type ReasoningDetail = { type?: string; text?: string };

type CompletionDelta = {
  content?: string;
  reasoning?: unknown;
  reasoning_content?: unknown;
  reasoning_details?: ReasoningDetail[];
  tool_calls?: Array<{
    index: number;
    id?: string;
    function?: { name?: string; arguments?: string };
  }>;
};

const STOP_SUMMARY_PROMPT =
  "The user stopped the agent. Summarize what you accomplished in this session, including partial outline/knowledge changes. Do not call tools.";

function isAbortError(e: unknown) {
  return e instanceof Error && e.name === "AbortError";
}

function clip(text: string, max = 80) {
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= max) return compact;
  return `${compact.slice(0, max - 1)}…`;
}

function thinkingFromDelta(delta?: CompletionDelta): string {
  if (!delta) return "";
  if (typeof delta.reasoning === "string" && delta.reasoning) return delta.reasoning;
  if (typeof delta.reasoning_content === "string" && delta.reasoning_content) {
    return delta.reasoning_content;
  }
  if (Array.isArray(delta.reasoning_details)) {
    return delta.reasoning_details
      .map((d) => (typeof d.text === "string" ? d.text : ""))
      .join("");
  }
  return "";
}

async function openRouterChat(body: Record<string, unknown>, signal?: AbortSignal) {
  const settings = getSettings();
  const apiKey = settings.openrouterApiKey || process.env.OPENROUTER_API_KEY || "";
  if (!apiKey) {
    throw new Error("OpenRouter API key not configured. Add it in Settings.");
  }
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://localhost:3000",
      "X-Title": "Quillsmith",
    },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenRouter error ${res.status}: ${errText}`);
  }
  return res;
}

async function* readCompletionStream(
  res: Response,
  signal?: AbortSignal,
): AsyncGenerator<
  AgentEvent,
  { assistantContent: string; toolCalls: Map<number, ToolCallAcc>; aborted: boolean }
> {
  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");
  const decoder = new TextDecoder();
  let buffer = "";
  let assistantContent = "";
  const toolCalls = new Map<number, ToolCallAcc>();
  let aborted = Boolean(signal?.aborted);

  const cancelReader = async () => {
    aborted = true;
    try {
      await reader.cancel();
    } catch {
      /* already closed */
    }
  };

  try {
    while (!aborted) {
      if (signal?.aborted) {
        await cancelReader();
        break;
      }
      let chunk: ReadableStreamReadResult<Uint8Array>;
      try {
        chunk = await reader.read();
      } catch (e) {
        if (isAbortError(e) || signal?.aborted) {
          aborted = true;
          break;
        }
        throw e;
      }
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (signal?.aborted) {
          await cancelReader();
          break;
        }
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const data = trimmed.slice(5).trim();
        if (data === "[DONE]") continue;
        let json: {
          error?: { message?: string };
          choices?: Array<{ delta?: CompletionDelta }>;
        };
        try {
          json = JSON.parse(data) as typeof json;
        } catch {
          continue;
        }
        if (json.error?.message) {
          throw new Error(json.error.message);
        }
        const delta = json.choices?.[0]?.delta;
        const thinking = thinkingFromDelta(delta);
        if (thinking) yield { type: "thinking", text: thinking };
        if (delta?.content) {
          assistantContent += delta.content;
          yield { type: "token", text: delta.content };
        }
        for (const tc of delta?.tool_calls ?? []) {
          const existing = toolCalls.get(tc.index) ?? {
            id: "",
            name: "",
            arguments: "",
          };
          if (tc.id) existing.id = tc.id;
          if (tc.function?.name) existing.name += tc.function.name;
          if (tc.function?.arguments) existing.arguments += tc.function.arguments;
          toolCalls.set(tc.index, existing);
        }
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      /* ignore */
    }
  }

  return { assistantContent, toolCalls, aborted };
}

async function* yieldFromCompletion(
  res: Response,
  signal: AbortSignal | undefined,
  onContent: (text: string) => void,
): AsyncGenerator<AgentEvent, { toolCalls: Map<number, ToolCallAcc>; aborted: boolean; assistantContent: string }> {
  const iter = readCompletionStream(res, signal);
  let step = await iter.next();
  while (!step.done) {
    const event = step.value;
    if (event.type === "token") onContent(event.text);
    yield event;
    step = await iter.next();
  }
  return step.value;
}

async function* yieldSummaryOnStop(opts: {
  model: string;
  temperature: number;
  messages: ChatMessage[];
}): AsyncGenerator<AgentEvent> {
  yield { type: "status", message: "Summarizing…" };
  const res = await openRouterChat({
    model: opts.model,
    temperature: opts.temperature,
    stream: true,
    include_reasoning: true,
    messages: [
      ...opts.messages,
      { role: "user", content: STOP_SUMMARY_PROMPT },
    ],
  });
  let text = "";
  const result = yield* yieldFromCompletion(res, undefined, (chunk) => {
    text += chunk;
  });
  yield { type: "done", text: text || result.assistantContent };
}

function fillSkippedTools(messages: ChatMessage[], remaining: ToolCallAcc[]) {
  for (const tc of remaining) {
    messages.push({
      role: "tool",
      tool_call_id: tc.id,
      content: JSON.stringify({ stopped: true, error: "Stopped by user" }),
    });
  }
}

export async function* runAgentLoop(opts: {
  model: string;
  temperature: number;
  messages: ChatMessage[];
  tools?: ToolDef[];
  novelId: string;
  signal?: AbortSignal;
}): AsyncGenerator<AgentEvent> {
  const messages = [...opts.messages];
  let finalText = "";
  let round = 0;

  const summarize = () =>
    yieldSummaryOnStop({
      model: opts.model,
      temperature: opts.temperature,
      messages,
    });

  try {
    while (true) {
      if (opts.signal?.aborted) {
        yield* summarize();
        return;
      }

      yield { type: "status", message: round === 0 ? "Generating…" : "Continuing after tools…" };
      round += 1;

      let res: Response;
      try {
        res = await openRouterChat(
          {
            model: opts.model,
            temperature: opts.temperature,
            stream: true,
            include_reasoning: true,
            messages,
            ...(opts.tools?.length ? { tools: opts.tools, tool_choice: "auto" } : {}),
          },
          opts.signal,
        );
      } catch (e) {
        if (isAbortError(e) || opts.signal?.aborted) {
          yield* summarize();
          return;
        }
        throw e;
      }

      const parsed = yield* yieldFromCompletion(res, opts.signal, (chunk) => {
        finalText += chunk;
      });

      if (parsed.aborted || opts.signal?.aborted) {
        if (parsed.assistantContent && parsed.toolCalls.size === 0) {
          messages.push({ role: "assistant", content: parsed.assistantContent });
        }
        yield* summarize();
        return;
      }

      if (parsed.toolCalls.size === 0) {
        yield { type: "done", text: finalText || parsed.assistantContent };
        return;
      }

      messages.push({
        role: "assistant",
        content: parsed.assistantContent || null,
        tool_calls: [...parsed.toolCalls.values()].map((tc) => ({
          id: tc.id,
          type: "function" as const,
          function: { name: tc.name, arguments: tc.arguments },
        })),
      });

      const pending = [...parsed.toolCalls.values()];
      for (let i = 0; i < pending.length; i++) {
        if (opts.signal?.aborted) {
          fillSkippedTools(messages, pending.slice(i));
          yield* summarize();
          return;
        }
        const tc = pending[i];
        const argsPreview = clip(tc.arguments || "");
        yield { type: "tool", name: tc.name, phase: "start", args: argsPreview };
        yield { type: "status", message: `Looking up… (${tc.name})` };
        let parsedArgs: Record<string, unknown> = {};
        try {
          parsedArgs = JSON.parse(tc.arguments || "{}") as Record<string, unknown>;
        } catch {
          parsedArgs = {};
        }
        const result = await executeTool(tc.name, parsedArgs, { novelId: opts.novelId });
        const preview = clip(JSON.stringify(result));
        yield { type: "tool", name: tc.name, phase: "done", preview };
        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify(result),
        });
      }
    }
  } catch (e) {
    if (isAbortError(e) || opts.signal?.aborted) {
      yield* summarize();
      return;
    }
    throw e;
  }
}

export function sseEncode(event: AgentEvent) {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export const CONTEXT_WARN_TOKENS = 24_000;
/** Soft cap: larger windows water down attention. Prefer summaries under this. */
export const CONTEXT_SOFT_CAP_TOKENS = 50_000;

export function estimateTokens(text: string) {
  return Math.ceil(text.length / 4);
}

export async function collectAgentText(events: AsyncIterable<AgentEvent>): Promise<string> {
  let full = "";
  for await (const event of events) {
    if (event.type === "token") full += event.text;
    if (event.type === "done") full = event.text || full;
    if (event.type === "error") throw new Error(event.message);
  }
  return full.trim();
}

export function extractJsonObject(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = (fenced?.[1] ?? text).trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("No JSON object in model output");
  return JSON.parse(raw.slice(start, end + 1));
}

type AgentLoopFactory = (signal: AbortSignal) => AsyncIterable<AgentEvent>;

export function agentSseResponse(events: AsyncIterable<AgentEvent> | AgentLoopFactory) {
  const { runId, signal } = createRun();
  const iterable = typeof events === "function" ? events(signal) : events;
  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      try {
        controller.enqueue(enc.encode(sseEncode({ type: "run", id: runId })));
        for await (const event of iterable) {
          controller.enqueue(enc.encode(sseEncode(event)));
        }
      } catch (e) {
        controller.enqueue(
          enc.encode(
            sseEncode({
              type: "error",
              message: e instanceof Error ? e.message : "Agent failed",
            }),
          ),
        );
      } finally {
        finishRun(runId);
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
}
