import type { AgentEvent } from "@/lib/openrouter";

export async function readSse(
  res: Response,
  onEvent: (event: AgentEvent) => void,
): Promise<string> {
  if (!res.body) throw new Error("No response body");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith("data:")) continue;
      const event = JSON.parse(line.slice(5).trim()) as AgentEvent;
      onEvent(event);
      if (event.type === "token" && event.text) full += event.text;
      if (event.type === "done") full = event.text || full;
      if (event.type === "error") throw new Error(event.message);
    }
  }
  return full;
}
