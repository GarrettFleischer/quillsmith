import { executeTool, type ToolDef } from "@/lib/tools";
import { getSettings } from "@/lib/novels";

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
  | { type: "status"; message: string }
  | { type: "token"; text: string }
  | { type: "tool"; name: string }
  | { type: "done"; text: string }
  | { type: "error"; message: string };

async function openRouterChat(body: Record<string, unknown>) {
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
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenRouter error ${res.status}: ${errText}`);
  }
  return res;
}

export async function* runAgentLoop(opts: {
  model: string;
  temperature: number;
  messages: ChatMessage[];
  tools?: ToolDef[];
  novelId: string;
  maxRounds?: number;
}): AsyncGenerator<AgentEvent> {
  const maxRounds = opts.maxRounds ?? 8;
  const messages = [...opts.messages];
  let finalText = "";

  for (let round = 0; round < maxRounds; round++) {
    yield { type: "status", message: round === 0 ? "Generating…" : "Continuing after tools…" };

    const res = await openRouterChat({
      model: opts.model,
      temperature: opts.temperature,
      stream: true,
      messages,
      ...(opts.tools?.length
        ? { tools: opts.tools, tool_choice: "auto" }
        : {}),
    });

    const reader = res.body?.getReader();
    if (!reader) throw new Error("No response body");
    const decoder = new TextDecoder();
    let buffer = "";
    let assistantContent = "";
    const toolCalls = new Map<
      number,
      { id: string; name: string; arguments: string }
    >();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const data = trimmed.slice(5).trim();
        if (data === "[DONE]") continue;
        try {
          const json = JSON.parse(data) as {
            choices?: Array<{
              delta?: {
                content?: string;
                tool_calls?: Array<{
                  index: number;
                  id?: string;
                  function?: { name?: string; arguments?: string };
                }>;
              };
            }>;
          };
          const delta = json.choices?.[0]?.delta;
          if (delta?.content) {
            assistantContent += delta.content;
            finalText += delta.content;
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
        } catch {
          // ignore partial JSON
        }
      }
    }

    if (toolCalls.size === 0) {
      yield { type: "done", text: finalText || assistantContent };
      return;
    }

    messages.push({
      role: "assistant",
      content: assistantContent || null,
      tool_calls: [...toolCalls.values()].map((tc) => ({
        id: tc.id,
        type: "function" as const,
        function: { name: tc.name, arguments: tc.arguments },
      })),
    });

    for (const tc of toolCalls.values()) {
      yield { type: "tool", name: tc.name };
      yield { type: "status", message: `Looking up… (${tc.name})` };
      let parsed: Record<string, unknown> = {};
      try {
        parsed = JSON.parse(tc.arguments || "{}") as Record<string, unknown>;
      } catch {
        parsed = {};
      }
      const result = await executeTool(tc.name, parsed, { novelId: opts.novelId });
      messages.push({
        role: "tool",
        tool_call_id: tc.id,
        content: JSON.stringify(result),
      });
    }
  }

  yield {
    type: "error",
    message: `Stopped after ${maxRounds} tool rounds without a final answer. Try again with a simpler request.`,
  };
}

export function sseEncode(event: AgentEvent) {
  return `data: ${JSON.stringify(event)}\n\n`;
}
