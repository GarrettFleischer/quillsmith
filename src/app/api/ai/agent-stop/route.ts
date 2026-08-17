import { stopRun } from "@/lib/agent-runs";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { runId?: string };
    if (!body.runId) {
      return Response.json({ error: "runId required" }, { status: 400 });
    }
    stopRun(body.runId);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 },
    );
  }
}
