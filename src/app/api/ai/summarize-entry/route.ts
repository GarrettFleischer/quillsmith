import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { knowledgeAppearances, knowledgeEntries } from "@/db/schema";
import { getSettings, upsertKnowledge } from "@/lib/novels";
import { SUMMARY_SYSTEM_PROMPT } from "@/lib/prompts/rules";
import { runAgentLoop, type ChatMessage } from "@/lib/openrouter";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      entryId: string;
      novelId: string;
      model?: string;
    };
    const db = getDb();
    const entry = db
      .select()
      .from(knowledgeEntries)
      .where(eq(knowledgeEntries.id, body.entryId))
      .get();
    if (!entry) {
      return Response.json({ error: "Entry not found" }, { status: 404 });
    }
    const appearances = db
      .select()
      .from(knowledgeAppearances)
      .where(eq(knowledgeAppearances.entryId, body.entryId))
      .all();

    const settings = getSettings();
    const model = body.model || settings.defaultModel || "anthropic/claude-sonnet-4";

    const messages: ChatMessage[] = [
      {
        role: "system",
        content: SUMMARY_SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: `Name: ${entry.name}\nType: ${entry.type}\nCurrent summary:\n${entry.summary}\n\nAppearance contexts:\n${appearances
          .map((a, i) => `${i + 1}. ${a.contextSnippet}`)
          .join("\n\n")}`,
      },
    ];

    let summary = "";
    for await (const event of runAgentLoop({
      model,
      temperature: 0.3,
      messages,
      novelId: body.novelId,
      tools: undefined,
    })) {
      if (event.type === "token") summary += event.text;
      if (event.type === "done") summary = event.text || summary;
      if (event.type === "error") {
        return Response.json({ error: event.message }, { status: 500 });
      }
    }

    return Response.json({
      entryId: entry.id,
      currentSummary: entry.summary,
      proposedSummary: summary.trim(),
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 },
    );
  }
}

export async function PUT(req: Request) {
  const body = (await req.json()) as {
    entryId: string;
    novelId: string;
    summary: string;
  };
  const db = getDb();
  const entry = db
    .select()
    .from(knowledgeEntries)
    .where(eq(knowledgeEntries.id, body.entryId))
    .get();
  if (!entry) {
    return Response.json({ error: "Entry not found" }, { status: 404 });
  }
  const updated = upsertKnowledge({
    id: entry.id,
    novelId: body.novelId,
    type: entry.type,
    name: entry.name,
    aliases: entry.aliases ?? "",
    summary: body.summary,
    notes: entry.notes ?? "",
  });
  return Response.json(updated);
}
