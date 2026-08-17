import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { knowledgeAppearances, knowledgeEntries } from "@/db/schema";
import { systemPromptForTask } from "@/lib/ai-tasks";
import { collectAgentText, runAgentLoop, type ChatMessage } from "@/lib/openrouter";
import { resolveTaskRuntime } from "@/lib/task-runtime";
import { upsertKnowledge } from "@/lib/novels";

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
    if (!entry || entry.novelId !== body.novelId) {
      return Response.json({ error: "Entry not found" }, { status: 404 });
    }
    const appearances = db
      .select()
      .from(knowledgeAppearances)
      .where(eq(knowledgeAppearances.entryId, body.entryId))
      .all();

    const { model, temperature } = resolveTaskRuntime("summarize_kb", body.model);

    const messages: ChatMessage[] = [
      {
        role: "system",
        content: systemPromptForTask("summarize_kb"),
      },
      {
        role: "user",
        content: `Name: ${entry.name}\nType: ${entry.type}\nCurrent summary:\n${entry.summary}\n\nAppearance contexts:\n${appearances
          .map((a, i) => `${i + 1}. ${a.contextSnippet}`)
          .join("\n\n")}`,
      },
    ];

    const summary = await collectAgentText(
      runAgentLoop({
        model,
        temperature,
        messages,
        novelId: body.novelId,
        tools: undefined,
      }),
    );

    return Response.json({
      entryId: entry.id,
      currentSummary: entry.summary,
      proposedSummary: summary,
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
  if (!entry || entry.novelId !== body.novelId) {
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
