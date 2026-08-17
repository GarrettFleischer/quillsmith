import { getNovel, upsertComp } from "@/lib/novels";
import { systemPromptForTask } from "@/lib/ai-tasks";
import { collectAgentText, runAgentLoop, type ChatMessage } from "@/lib/openrouter";
import { resolveTaskRuntime } from "@/lib/task-runtime";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      novelId: string;
      title: string;
      author?: string;
      notes?: string;
      excerpt?: string;
      model?: string;
      save?: boolean;
    };
    const novel = getNovel(body.novelId);
    if (!novel) return Response.json({ error: "Novel not found" }, { status: 404 });
    if (!body.title.trim()) {
      return Response.json({ error: "Title required" }, { status: 400 });
    }
    const { model, temperature } = resolveTaskRuntime("analyze_comp", body.model);
    const messages: ChatMessage[] = [
      { role: "system", content: systemPromptForTask("analyze_comp") },
      {
        role: "user",
        content: `Comparison book: ${body.title}
Author: ${body.author ?? "(unknown)"}
This novel's genre/tone: ${novel.genre} / ${novel.tone}

Notes from the author:
${body.notes ?? "(none)"}

Excerpt or chapter notes:
${body.excerpt ?? "(none)"}`,
      },
    ];
    const breakdown = await collectAgentText(
      runAgentLoop({ model, temperature, messages, novelId: body.novelId }),
    );
    let saved = null;
    if (body.save !== false) {
      saved = upsertComp({
        novelId: body.novelId,
        title: body.title,
        author: body.author,
        notes: body.notes,
        chapterBreakdownJson: breakdown,
      });
    }
    return Response.json({ breakdown, comp: saved });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 },
    );
  }
}
