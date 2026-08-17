export type ToolTraceEntry = {
  id: string;
  name: string;
  phase: "start" | "done";
  args?: string;
  preview?: string;
};

export type AgentStreamState = {
  runId: string | null;
  thinking: string;
  tools: ToolTraceEntry[];
  output: string;
  status: string;
  stopped: boolean;
  apply?: "append" | "replace";
};

type StreamEvent = {
  type: string;
  id?: string;
  text?: string;
  message?: string;
  name?: string;
  phase?: "start" | "done";
  args?: string;
  preview?: string;
  apply?: "append" | "replace";
};

function applyToolEvent(
  tools: ToolTraceEntry[],
  event: { name: string; phase?: "start" | "done"; args?: string; preview?: string },
): ToolTraceEntry[] {
  const phase = event.phase ?? "start";
  if (phase === "done") {
    const next = [...tools];
    for (let i = next.length - 1; i >= 0; i--) {
      if (next[i].name === event.name && next[i].phase === "start") {
        next[i] = { ...next[i], phase: "done", preview: event.preview };
        return next;
      }
    }
    return [
      ...next,
      {
        id: `tool-${next.length}`,
        name: event.name,
        phase: "done",
        preview: event.preview,
      },
    ];
  }
  return [
    ...tools,
    {
      id: `tool-${tools.length}`,
      name: event.name,
      phase: "start",
      args: event.args,
    },
  ];
}

export async function consumeAgentStream(
  response: Response,
  onUpdate: (state: AgentStreamState) => void,
): Promise<{ output: string; stopped: boolean; apply?: "append" | "replace" }> {
  if (!response.body) throw new Error("No response body");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const state: AgentStreamState = {
    runId: null,
    thinking: "",
    tools: [],
    output: "",
    status: "",
    stopped: false,
  };

  const emit = () => onUpdate({ ...state, tools: [...state.tools] });

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith("data:")) continue;
      const event = JSON.parse(line.slice(5).trim()) as StreamEvent;
      if (event.type === "run" && event.id) {
        state.runId = event.id;
      } else if (event.type === "thinking" && event.text) {
        state.thinking += event.text;
      } else if (event.type === "token" && event.text) {
        state.output += event.text;
      } else if (event.type === "status") {
        state.status = event.message || "";
        if (event.message === "Summarizing…") {
          state.stopped = true;
          state.output = "";
        }
      } else if (event.type === "tool" && event.name) {
        state.tools = applyToolEvent(state.tools, {
          name: event.name,
          phase: event.phase,
          args: event.args,
          preview: event.preview,
        });
      } else if (event.type === "done") {
        state.output = event.text || state.output;
        state.status = "";
        if (event.apply) state.apply = event.apply;
      } else if (event.type === "error") {
        throw new Error(event.message || "Agent failed");
      }
      emit();
    }
  }

  return { output: state.output, stopped: state.stopped, apply: state.apply };
}

export async function stopAgentRun(runId: string) {
  await fetch("/api/ai/agent-stop", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ runId }),
  });
}
