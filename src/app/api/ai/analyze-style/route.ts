import { getNovel, updateNovelOverview } from "@/lib/novels";
import { systemPromptForTask } from "@/lib/ai-tasks";
import { collectAgentText, extractJsonObject, runAgentLoop, type ChatMessage } from "@/lib/openrouter";
import { parseStyleGuide, type StyleGuide } from "@/lib/prompts/context";
import { resolveTaskRuntime } from "@/lib/task-runtime";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      novelId: string;
      samples?: Array<{ excerpt: string; note?: string }>;
      model?: string;
    };
    const novel = getNovel(body.novelId);
    if (!novel) return Response.json({ error: "Novel not found" }, { status: 404 });
    const samples: Array<{ excerpt: string; note?: string }> =
      body.samples?.filter((s) => s.excerpt.trim()) ??
      (JSON.parse(novel.styleSamplesJson || "[]") as Array<{ excerpt: string; note?: string }>);
    if (!samples.length) {
      return Response.json({ error: "Add 2–5 sample passages first" }, { status: 400 });
    }
    const { model, temperature } = resolveTaskRuntime("analyze_style", body.model);
    const messages: ChatMessage[] = [
      { role: "system", content: systemPromptForTask("analyze_style") },
      {
        role: "user",
        content: samples
          .map((s, i) => `Sample ${i + 1}${s.note ? ` (${s.note})` : ""}:\n${s.excerpt}`)
          .join("\n\n"),
      },
    ];
    const raw = await collectAgentText(
      runAgentLoop({ model, temperature, messages, novelId: body.novelId }),
    );
    let proposed: StyleGuide = { rules: [] };
    try {
      proposed = extractJsonObject(raw) as StyleGuide;
    } catch {
      proposed = { rules: [raw], approved: false };
    }
    proposed.approved = false;
    return Response.json({ proposed, raw });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 },
    );
  }
}

export async function PUT(req: Request) {
  const body = (await req.json()) as {
    novelId: string;
    styleGuide?: StyleGuide;
    styleSamples?: Array<{ sceneId?: string; excerpt: string; note?: string }>;
    approved?: boolean;
  };
  const novel = getNovel(body.novelId);
  if (!novel) return Response.json({ error: "Novel not found" }, { status: 404 });
  const current = parseStyleGuide(novel.styleGuideJson) ?? {};
  const next = {
    ...current,
    ...(body.styleGuide ?? {}),
    approved: body.approved ?? current.approved ?? false,
  };
  const updated = updateNovelOverview(body.novelId, {
    styleGuideJson: JSON.stringify(next),
    ...(body.styleSamples
      ? { styleSamplesJson: JSON.stringify(body.styleSamples) }
      : {}),
  });
  return Response.json({
    styleGuide: parseStyleGuide(updated.styleGuideJson),
    styleSamples: JSON.parse(updated.styleSamplesJson || "[]"),
  });
}
