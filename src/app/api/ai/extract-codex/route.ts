import {
  getNovelTree,
  getSettings,
  listKnowledge,
} from "@/lib/novels";
import { actLabel, chapterLabel } from "@/lib/manuscript";
import { normalizeCodexType } from "@/lib/codex-ui";
import {
  collectAgentText,
  extractJsonObject,
  runAgentLoop,
  type ChatMessage,
} from "@/lib/openrouter";

export const runtime = "nodejs";

const EXTRACT_SYSTEM = `You are a story-bible editor. From a novel's plan (premise, act and chapter summaries, and beats), extract the codex entries worth tracking.

Return NEW entries for the recurring characters, locations, lore, and items that the plan clearly involves and that are not already in the bible, and UPDATES for existing entries when the plan adds concrete facts about them.

Rules:
- type must be one of: character, location, lore, item, other.
- name is the canonical name as it appears in the plan.
- summary is 1–2 sentences, grounded ONLY in the plan (no invention).
- aliases is a comma-separated list or "".
- For an update, set action "update" and copy the existing entry's id verbatim; otherwise action "create".
- Do not duplicate an existing entry as a new one. Skip anything the plan does not actually evidence.

Return ONLY minified JSON in exactly this shape:
{"entries":[{"action":"create","id":"","type":"character","name":"","aliases":"","summary":"","reason":""}]}`;

type Proposal = {
  action: "create" | "update";
  id?: string;
  type: string;
  name: string;
  aliases: string;
  summary: string;
  reason: string;
  previousSummary?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { novelId: string; model?: string };
    const tree = getNovelTree(body.novelId);
    if (!tree) return Response.json({ error: "Novel not found" }, { status: 404 });

    const existing = listKnowledge(body.novelId);

    const planLines: string[] = [];
    if (tree.novel.premise) planLines.push(`Premise: ${tree.novel.premise}`);
    if (tree.novel.genre) planLines.push(`Genre: ${tree.novel.genre}`);
    if (tree.novel.tone) planLines.push(`Tone: ${tree.novel.tone}`);
    tree.acts.forEach((act, ai) => {
      planLines.push(`\n## ${actLabel(ai, act.title)}`);
      if (act.summary) planLines.push(`Act summary: ${act.summary}`);
      act.chapters.forEach((ch, ci) => {
        planLines.push(`\n### ${chapterLabel(ci, ch.title)}`);
        if (ch.goal) planLines.push(`Goal: ${ch.goal}`);
        if (ch.summary) planLines.push(`Summary: ${ch.summary}`);
        if (ch.beats.length) {
          planLines.push("Beats:");
          ch.beats.forEach((b, bi) => planLines.push(`${bi + 1}. ${b.content}`));
        }
      });
    });
    const plan = planLines.join("\n").trim();
    if (!plan) {
      return Response.json(
        { error: "Nothing to extract yet — add summaries and beats first." },
        { status: 400 },
      );
    }

    const existingBlock = existing.length
      ? existing
          .map(
            (e) =>
              `- [${e.id}] (${e.type}) ${e.name}${e.aliases ? ` — aliases: ${e.aliases}` : ""} — ${e.summary || "(no summary)"}`,
          )
          .join("\n")
      : "(none yet)";

    const model = body.model?.trim() || getSettings().defaultModel || "anthropic/claude-sonnet-4";
    const messages: ChatMessage[] = [
      { role: "system", content: EXTRACT_SYSTEM },
      {
        role: "user",
        content: `Existing codex entries:\n${existingBlock}\n\nPlan:\n${plan}`,
      },
    ];

    const raw = await collectAgentText(
      runAgentLoop({
        model,
        temperature: 0.3,
        messages,
        novelId: body.novelId,
        reasoningEnabled: false,
        maxTokens: 2500,
      }),
    );

    let parsed: Proposal[] = [];
    try {
      const obj = extractJsonObject(raw) as { entries?: unknown };
      if (Array.isArray(obj.entries)) {
        parsed = obj.entries as Proposal[];
      }
    } catch {
      parsed = [];
    }

    // Reconcile create/update against the real bible so the client always gets
    // a correct classification regardless of how the model handled ids.
    const byId = new Map(existing.map((e) => [e.id, e]));
    const byName = new Map(existing.map((e) => [e.name.trim().toLowerCase(), e]));
    const seen = new Set<string>();
    const proposals: Proposal[] = [];
    for (const p of parsed) {
      const name = String(p?.name ?? "").trim();
      const summary = String(p?.summary ?? "").trim();
      if (!name || !summary) continue;
      const match =
        (p.id && byId.get(String(p.id))) || byName.get(name.toLowerCase()) || null;
      const dedupeKey = (match?.id ?? name.toLowerCase());
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      proposals.push({
        action: match ? "update" : "create",
        id: match?.id,
        type: normalizeCodexType(String(p?.type ?? "other")),
        name,
        aliases: String(p?.aliases ?? "").trim(),
        summary,
        reason: String(p?.reason ?? "").trim(),
        previousSummary: match?.summary ?? undefined,
      });
    }

    return Response.json({ proposals });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Extraction failed" },
      { status: 500 },
    );
  }
}
