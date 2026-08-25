import { getSettings, getNovel, updateNovelOverview, updateSettings } from "@/lib/novels";
import { systemPromptForTask } from "@/lib/ai-tasks";
import { collectAgentText, extractJsonObject, runAgentLoop, type ChatMessage } from "@/lib/openrouter";
import {
  coerceStyleGuide,
  filledStyleSamples,
  formatSamplesForAnalysis,
  MIN_SAMPLE_WORDS,
  parseStyleGuide,
  parseStyleSamples,
  serializeStyleGuide,
  serializeStyleSamples,
  styleSampleStats,
  type StyleGuide,
  type StyleSample,
} from "@/lib/prompts/style-guide";
import { resolveTaskRuntime } from "@/lib/task-runtime";

export const runtime = "nodejs";

function readSamples(body: {
  samples?: StyleSample[];
  novelId?: string;
}): StyleSample[] {
  if (body.samples?.length) {
    return parseStyleSamples(JSON.stringify(body.samples));
  }
  if (body.novelId) {
    const novel = getNovel(body.novelId);
    if (novel?.styleSamplesJson) return parseStyleSamples(novel.styleSamplesJson);
  }
  return parseStyleSamples(getSettings().authorStyleSamplesJson);
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      novelId?: string;
      samples?: StyleSample[];
      model?: string;
    };
    const samples = readSamples(body);
    const stats = styleSampleStats(samples);
    if (stats.filled < 3) {
      return Response.json(
        {
          error:
            "Paste three finished fiction samples first: action/pressure, dialogue-heavy, and a quiet/interior moment.",
        },
        { status: 400 },
      );
    }
    if (!stats.ready) {
      return Response.json(
        {
          error: `Each sample needs at least ${MIN_SAMPLE_WORDS} words so the fingerprint is not guessing.`,
        },
        { status: 400 },
      );
    }
    const { model, temperature } = resolveTaskRuntime("analyze_style", body.model);
    const messages: ChatMessage[] = [
      { role: "system", content: systemPromptForTask("analyze_style") },
      { role: "user", content: formatSamplesForAnalysis(samples) },
    ];
    const raw = await collectAgentText(
      runAgentLoop({
        model,
        temperature,
        messages,
        novelId: body.novelId || "settings",
      }),
    );
    let proposed: StyleGuide = { approved: false, rules: [] };
    try {
      proposed = coerceStyleGuide(extractJsonObject(raw));
    } catch {
      proposed = { approved: false, rules: [raw] };
    }
    proposed.approved = false;
    proposed.generatedAt = new Date().toISOString();
    if (!proposed.exampleAnchor) {
      const longest = filledStyleSamples(samples).sort(
        (a, b) => b.excerpt.trim().length - a.excerpt.trim().length,
      )[0];
      if (longest) {
        const words = longest.excerpt.trim().split(/\s+/);
        proposed.exampleAnchor = words.slice(0, 280).join(" ");
      }
    }
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
    novelId?: string;
    styleGuide?: StyleGuide;
    styleSamples?: StyleSample[];
    approved?: boolean;
    scope?: "author" | "novel";
  };
  const scope = body.scope ?? (body.novelId ? "novel" : "author");

  if (scope === "author") {
    const settings = getSettings();
    const current = parseStyleGuide(settings.authorStyleGuideJson) ?? {};
    const next: StyleGuide = body.styleGuide
      ? {
          ...body.styleGuide,
          approved: body.approved ?? body.styleGuide.approved ?? false,
        }
      : {
          ...current,
          approved: body.approved ?? current.approved ?? false,
        };
    const updated = updateSettings({
      authorStyleGuideJson: serializeStyleGuide(next),
      ...(body.styleSamples ? { authorStyleSamplesJson: serializeStyleSamples(body.styleSamples) } : {}),
    });
    return Response.json({
      styleGuide: parseStyleGuide(updated.authorStyleGuideJson),
      styleSamples: parseStyleSamples(updated.authorStyleSamplesJson),
      scope: "author",
    });
  }

  if (!body.novelId) {
    return Response.json({ error: "Novel id required" }, { status: 400 });
  }
  const novel = getNovel(body.novelId);
  if (!novel) return Response.json({ error: "Novel not found" }, { status: 404 });
  const current = parseStyleGuide(novel.styleGuideJson) ?? {};
  const next = {
    ...current,
    ...(body.styleGuide ?? {}),
    approved: body.approved ?? current.approved ?? false,
  };
  const updated = updateNovelOverview(body.novelId, {
    styleGuideJson: serializeStyleGuide(next),
    ...(body.styleSamples
      ? { styleSamplesJson: serializeStyleSamples(body.styleSamples) }
      : {}),
  });
  return Response.json({
    styleGuide: parseStyleGuide(updated.styleGuideJson),
    styleSamples: parseStyleSamples(updated.styleSamplesJson),
    scope: "novel",
  });
}
