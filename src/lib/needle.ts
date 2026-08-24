import type { ToolDef } from "@/lib/tools";

/**
 * Client for the local Needle 2 sidecar (services/needle/server.py).
 *
 * Needle is a 45M-param tool-calling model: given a natural-language
 * description of the next action plus our tool schemas, it returns the
 * concrete function call(s) to run. The big model reasons/plans; Needle turns
 * each step into a typed call that we execute in `executeTool`.
 */

const NEEDLE_URL = process.env.NEEDLE_URL || "http://127.0.0.1:8787";

export type NeedleCall = { name: string; arguments: Record<string, unknown> };

export type NeedleResult = {
  type: string | null;
  functionCalls: NeedleCall[];
  confidence: number | null;
  reasoning: string | null;
  error?: string;
};

/** Needle wants flat `{name, description, parameters}` schemas. */
function toNeedleTools(tools: ToolDef[]) {
  return tools.map((t) => ({
    name: t.function.name,
    description: t.function.description,
    parameters: t.function.parameters,
  }));
}

export async function needleComplete(
  tools: ToolDef[],
  text: string,
  opts?: { system?: string; signal?: AbortSignal },
): Promise<NeedleResult> {
  let res: Response;
  try {
    res = await fetch(`${NEEDLE_URL}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tools: toNeedleTools(tools), text, system: opts?.system }),
      signal: opts?.signal,
    });
  } catch {
    return {
      type: null,
      functionCalls: [],
      confidence: null,
      reasoning: null,
      error:
        "Needle sidecar is not reachable. Start it with `python3 services/needle/server.py` (see AGENTS.md).",
    };
  }
  const data = (await res.json().catch(() => ({}))) as {
    type?: string;
    function_calls?: NeedleCall[];
    confidence?: number | null;
    reasoning?: string | null;
    error?: string;
  };
  if (!res.ok || data.error) {
    return {
      type: null,
      functionCalls: [],
      confidence: null,
      reasoning: null,
      error: data.error || `Needle sidecar error ${res.status}`,
    };
  }
  return {
    type: data.type ?? null,
    functionCalls: Array.isArray(data.function_calls) ? data.function_calls : [],
    confidence: typeof data.confidence === "number" ? data.confidence : null,
    reasoning: data.reasoning ?? null,
  };
}

export async function needleHealthy(): Promise<boolean> {
  try {
    const res = await fetch(`${NEEDLE_URL}/health`, {
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return false;
    const j = (await res.json()) as { ok?: boolean };
    return Boolean(j.ok);
  } catch {
    return false;
  }
}
