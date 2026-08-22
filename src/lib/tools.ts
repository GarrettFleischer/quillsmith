import { and, asc, desc, eq, like, or } from "drizzle-orm";
import { getDb } from "@/db";
import {
  acts,
  beats,
  chapters,
  knowledgeAppearances,
  knowledgeEntries,
  novels,
  overviewAnswers,
  sceneRevisions,
  scenes,
} from "@/db/schema";
import {
  setOverviewAnswer,
  updateNovelOverview,
  upsertAct,
  upsertBeat,
  upsertChapter,
  upsertKnowledge,
  replaceChapterBeats,
} from "@/lib/novels";
import { QUESTION_BANK } from "@/lib/question-bank";
import { plainFromTipTap } from "@/lib/utils";

export type ToolDef = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export const PROSE_TOOLS: ToolDef[] = [
  {
    type: "function",
    function: {
      name: "search_knowledge",
      description: "Search knowledge base entries by query and optional type",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          types: { type: "string", description: "comma-separated types" },
          limit: { type: "number" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_knowledge_entry",
      description: "Get a knowledge entry by id or exact name",
      parameters: {
        type: "object",
        properties: {
          entryId: { type: "string" },
          name: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_knowledge_appearances",
      description: "List appearance contexts for a knowledge entry",
      parameters: {
        type: "object",
        properties: {
          entryId: { type: "string" },
          limit: { type: "number" },
        },
        required: ["entryId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_chapter_revisions",
      description: "Fetch prior revisions of this chapter's prose",
      parameters: {
        type: "object",
        properties: {
          sceneId: { type: "string" },
          chapterId: { type: "string" },
          limit: { type: "number" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_act_brief",
      description: "Get act title and brief",
      parameters: {
        type: "object",
        properties: { actId: { type: "string" } },
        required: ["actId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_chapter_goal",
      description: "Get chapter title and goal",
      parameters: {
        type: "object",
        properties: { chapterId: { type: "string" } },
        required: ["chapterId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_chapter_beats",
      description: "List ordered beats for a chapter",
      parameters: {
        type: "object",
        properties: { chapterId: { type: "string" } },
        required: ["chapterId"],
      },
    },
  },
];

export const OVERVIEW_TOOLS: ToolDef[] = [
  {
    type: "function",
    function: {
      name: "get_overview",
      description: "Get novel overview fields and answers",
      parameters: {
        type: "object",
        properties: { novelId: { type: "string" } },
        required: ["novelId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_checklist_status",
      description: "Return question bank items and which have answers",
      parameters: {
        type: "object",
        properties: { novelId: { type: "string" } },
        required: ["novelId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_acts",
      description: "List acts for the novel",
      parameters: {
        type: "object",
        properties: { novelId: { type: "string" } },
        required: ["novelId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_chapters",
      description: "List chapters for an act",
      parameters: {
        type: "object",
        properties: { actId: { type: "string" } },
        required: ["actId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_beats",
      description: "List beats for a chapter",
      parameters: {
        type: "object",
        properties: { chapterId: { type: "string" } },
        required: ["chapterId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_knowledge",
      description: "Search knowledge base",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          novelId: { type: "string" },
        },
        required: ["query", "novelId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "upsert_novel_overview",
      description: "Update novel overview fields",
      parameters: {
        type: "object",
        properties: {
          novelId: { type: "string" },
          title: { type: "string" },
          premise: { type: "string" },
          genre: { type: "string" },
          tone: { type: "string" },
          themes: { type: "string" },
          stakes: { type: "string" },
          protagonistFocus: { type: "string" },
          endingIntention: { type: "string" },
          notes: { type: "string" },
        },
        required: ["novelId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "upsert_act",
      description: "Create or update an act",
      parameters: {
        type: "object",
        properties: {
          novelId: { type: "string" },
          id: { type: "string" },
          title: { type: "string" },
          brief: { type: "string" },
          introduces: { type: "string" },
          accomplishes: { type: "string" },
          losses: { type: "string" },
          stateStart: { type: "string" },
          stateEnd: { type: "string" },
          order: { type: "number" },
        },
        required: ["novelId", "title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "upsert_chapter",
      description: "Create or update a chapter under an act",
      parameters: {
        type: "object",
        properties: {
          novelId: { type: "string" },
          actId: { type: "string" },
          id: { type: "string" },
          title: { type: "string" },
          goal: { type: "string" },
          order: { type: "number" },
        },
        required: ["novelId", "actId", "title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "upsert_beat",
      description: "Create or update a chapter beat",
      parameters: {
        type: "object",
        properties: {
          novelId: { type: "string" },
          chapterId: { type: "string" },
          id: { type: "string" },
          content: { type: "string" },
          order: { type: "number" },
        },
        required: ["novelId", "chapterId", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_overview_answer",
      description: "Save an answer for a question-bank id",
      parameters: {
        type: "object",
        properties: {
          novelId: { type: "string" },
          questionId: { type: "string" },
          answer: { type: "string" },
        },
        required: ["novelId", "questionId", "answer"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "suggest_kb_stub",
      description: "Create a thin knowledge stub for a named entity",
      parameters: {
        type: "object",
        properties: {
          novelId: { type: "string" },
          type: { type: "string" },
          name: { type: "string" },
          summary: { type: "string" },
        },
        required: ["novelId", "type", "name"],
      },
    },
  },
];

export const CHAPTER_CHAT_TOOLS: ToolDef[] = [
  ...PROSE_TOOLS,
  {
    type: "function",
    function: {
      name: "update_chapter_summary",
      description: "Replace the working summary for the current chapter (always the open chapter)",
      parameters: {
        type: "object",
        properties: {
          summary: { type: "string" },
        },
        required: ["summary"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "replace_beats",
      description:
        "Replace the current chapter's beat list with an ordered array of beat sentences",
      parameters: {
        type: "object",
        properties: {
          contents: {
            type: "array",
            items: { type: "string" },
            description: "Ordered beat lines",
          },
        },
        required: ["contents"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "upsert_beat",
      description: "Create or update one beat on the current chapter",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string" },
          content: { type: "string" },
          order: { type: "number" },
        },
        required: ["content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_chapter_rewrite",
      description:
        "Queue replacement or appended chapter prose for the author to review as hunks. Never overwrites the manuscript.",
      parameters: {
        type: "object",
        properties: {
          text: { type: "string", description: "Proposed chapter prose" },
          apply: {
            type: "string",
            enum: ["replace", "append"],
            description: "replace reviews a full rewrite; append adds after existing prose",
          },
        },
        required: ["text"],
      },
    },
  },
];

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: { novelId: string; chapterId?: string },
): Promise<unknown> {
  const db = getDb();
  switch (name) {
    case "search_knowledge": {
      const query = String(args.query ?? "");
      const novelId = ctx.novelId;
      const limit = Number(args.limit ?? 10);
      const rows = db
        .select()
        .from(knowledgeEntries)
        .where(
          and(
            eq(knowledgeEntries.novelId, novelId),
            or(
              like(knowledgeEntries.name, `%${query}%`),
              like(knowledgeEntries.aliases, `%${query}%`),
              like(knowledgeEntries.summary, `%${query}%`),
            ),
          ),
        )
        .limit(limit)
        .all();
      return rows.map((r) => ({
        id: r.id,
        type: r.type,
        name: r.name,
        summary: (r.summary ?? "").slice(0, 240),
      }));
    }
    case "get_knowledge_entry": {
      if (args.entryId) {
        return (
          db
            .select()
            .from(knowledgeEntries)
            .where(
              and(
                eq(knowledgeEntries.id, String(args.entryId)),
                eq(knowledgeEntries.novelId, ctx.novelId),
              ),
            )
            .get() ?? { error: "Entry not found" }
        );
      }
      return (
        db
          .select()
          .from(knowledgeEntries)
          .where(
            and(
              eq(knowledgeEntries.novelId, ctx.novelId),
              eq(knowledgeEntries.name, String(args.name ?? "")),
            ),
          )
          .get() ?? { error: "Entry not found" }
      );
    }
    case "get_knowledge_appearances": {
      const entry = db
        .select()
        .from(knowledgeEntries)
        .where(
          and(
            eq(knowledgeEntries.id, String(args.entryId)),
            eq(knowledgeEntries.novelId, ctx.novelId),
          ),
        )
        .get();
      if (!entry) return { error: "Entry not found" };
      const limit = Number(args.limit ?? 20);
      return db
        .select()
        .from(knowledgeAppearances)
        .where(eq(knowledgeAppearances.entryId, entry.id))
        .orderBy(desc(knowledgeAppearances.createdAt))
        .limit(limit)
        .all();
    }
    case "get_scene_revisions":
    case "get_chapter_revisions": {
      let sceneId = args.sceneId ? String(args.sceneId) : "";
      if (!sceneId && (args.chapterId || ctx.chapterId)) {
        const chapterId = String(args.chapterId ?? ctx.chapterId);
        const row = db
          .select()
          .from(scenes)
          .where(eq(scenes.chapterId, chapterId))
          .orderBy(asc(scenes.order))
          .get();
        sceneId = row?.id ?? "";
      }
      const scene = sceneId
        ? db.select().from(scenes).where(eq(scenes.id, sceneId)).get()
        : null;
      if (!scene) return { error: "Chapter not found" };
      const chapter = db.select().from(chapters).where(eq(chapters.id, scene.chapterId)).get();
      const act = chapter
        ? db.select().from(acts).where(eq(acts.id, chapter.actId)).get()
        : null;
      if (!act || act.novelId !== ctx.novelId) return { error: "Chapter not found" };
      const limit = Number(args.limit ?? 5);
      const rows = db
        .select()
        .from(sceneRevisions)
        .where(eq(sceneRevisions.sceneId, scene.id))
        .orderBy(desc(sceneRevisions.createdAt))
        .limit(limit)
        .all();
      return rows.map((r) => ({
        id: r.id,
        source: r.source,
        label: r.label,
        createdAt: r.createdAt,
        excerpt: plainFromTipTap(r.content).slice(0, 1500),
      }));
    }
    case "get_act_brief": {
      const act = db.select().from(acts).where(eq(acts.id, String(args.actId))).get();
      if (!act || act.novelId !== ctx.novelId) return { error: "Act not found" };
      return act;
    }
    case "get_chapter_goal": {
      const goalChapterId = ctx.chapterId ?? String(args.chapterId ?? "");
      const chapter = db.select().from(chapters).where(eq(chapters.id, goalChapterId)).get();
      if (!chapter) return { error: "Chapter not found" };
      const act = db.select().from(acts).where(eq(acts.id, chapter.actId)).get();
      if (!act || act.novelId !== ctx.novelId) return { error: "Chapter not found" };
      return chapter;
    }
    case "get_chapter_beats": {
      const beatsChapterId = ctx.chapterId ?? String(args.chapterId ?? "");
      const chapter = db.select().from(chapters).where(eq(chapters.id, beatsChapterId)).get();
      if (!chapter) return { error: "Chapter not found" };
      const act = db.select().from(acts).where(eq(acts.id, chapter.actId)).get();
      if (!act || act.novelId !== ctx.novelId) return { error: "Chapter not found" };
      return db
        .select()
        .from(beats)
        .where(eq(beats.chapterId, chapter.id))
        .orderBy(asc(beats.order))
        .all();
    }
    case "get_overview": {
      const novel = db.select().from(novels).where(eq(novels.id, ctx.novelId)).get();
      const answers = db
        .select()
        .from(overviewAnswers)
        .where(eq(overviewAnswers.novelId, ctx.novelId))
        .all();
      return { novel, answers };
    }
    case "get_checklist_status": {
      const answers = db
        .select()
        .from(overviewAnswers)
        .where(eq(overviewAnswers.novelId, ctx.novelId))
        .all();
      const answered = new Set(answers.map((a) => a.questionId));
      return QUESTION_BANK.map((q) => ({
        ...q,
        answered: answered.has(q.id),
        answer: answers.find((a) => a.questionId === q.id)?.answer ?? "",
      }));
    }
    case "list_acts": {
      return db
        .select()
        .from(acts)
        .where(eq(acts.novelId, ctx.novelId))
        .orderBy(asc(acts.order))
        .all();
    }
    case "list_chapters": {
      return db
        .select()
        .from(chapters)
        .where(eq(chapters.actId, String(args.actId)))
        .orderBy(asc(chapters.order))
        .all();
    }
    case "list_beats": {
      return db
        .select()
        .from(beats)
        .where(eq(beats.chapterId, String(args.chapterId)))
        .orderBy(asc(beats.order))
        .all();
    }
    case "upsert_novel_overview": {
      const { novelId: _n, ...patch } = args as Record<string, string>;
      return updateNovelOverview(ctx.novelId, patch);
    }
    case "upsert_act": {
      return upsertAct({
        id: args.id ? String(args.id) : undefined,
        novelId: ctx.novelId,
        title: String(args.title),
        brief: args.brief != null ? String(args.brief) : undefined,
        introduces: args.introduces != null ? String(args.introduces) : undefined,
        accomplishes: args.accomplishes != null ? String(args.accomplishes) : undefined,
        losses: args.losses != null ? String(args.losses) : undefined,
        stateStart: args.stateStart != null ? String(args.stateStart) : undefined,
        stateEnd: args.stateEnd != null ? String(args.stateEnd) : undefined,
        order: args.order != null ? Number(args.order) : undefined,
      });
    }
    case "upsert_chapter": {
      return upsertChapter({
        id: args.id ? String(args.id) : undefined,
        actId: args.actId != null ? String(args.actId) : undefined,
        novelId: ctx.novelId,
        title: String(args.title),
        goal: args.goal != null ? String(args.goal) : undefined,
        order: args.order != null ? Number(args.order) : undefined,
      });
    }
    case "upsert_beat": {
      // In chapter chat the current chapter (ctx) always wins so a model that
      // invents a chapterId can't break out of the chapter it's editing.
      const chapterId = ctx.chapterId ?? String(args.chapterId ?? "");
      if (!chapterId) return { error: "chapterId required" };
      return upsertBeat({
        id: args.id ? String(args.id) : undefined,
        chapterId,
        novelId: ctx.novelId,
        content: String(args.content),
        order: args.order != null ? Number(args.order) : undefined,
      });
    }
    case "update_chapter_summary": {
      const chapterId = ctx.chapterId ?? String(args.chapterId ?? "");
      if (!chapterId) return { error: "chapterId required" };
      const chapter = db.select().from(chapters).where(eq(chapters.id, chapterId)).get();
      if (!chapter) return { error: "Chapter not found" };
      return upsertChapter({
        id: chapterId,
        novelId: ctx.novelId,
        title: chapter.title,
        summary: String(args.summary ?? ""),
      });
    }
    case "replace_beats": {
      const chapterId = ctx.chapterId ?? String(args.chapterId ?? "");
      if (!chapterId) return { error: "chapterId required" };
      const contents = Array.isArray(args.contents)
        ? args.contents.map((c) => String(c).trim()).filter(Boolean)
        : String(args.contents ?? "")
            .split("\n")
            .map((c) => c.replace(/^\d+\.\s*/, "").trim())
            .filter(Boolean);
      return replaceChapterBeats(chapterId, ctx.novelId, contents);
    }
    case "propose_chapter_rewrite": {
      const text = String(args.text ?? "").trim();
      if (!text) return { error: "text required" };
      return {
        queued: true,
        apply: args.apply === "append" ? "append" : "replace",
        text,
      };
    }
    case "set_overview_answer": {
      return setOverviewAnswer(
        ctx.novelId,
        String(args.questionId),
        String(args.answer),
      );
    }
    case "suggest_kb_stub": {
      return upsertKnowledge({
        novelId: ctx.novelId,
        type: String(args.type ?? "other"),
        name: String(args.name),
        summary: String(args.summary ?? ""),
      });
    }
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

