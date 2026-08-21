import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { knowledgeAppearances, knowledgeEntries, scenes } from "@/db/schema";
import { id, now, plainFromTipTap } from "@/lib/utils";

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function contextAround(text: string, index: number, length: number) {
  const start = Math.max(0, text.lastIndexOf(".", Math.max(0, index - 120)) + 1);
  const endCandidate = text.indexOf(".", index + length + 80);
  const end = endCandidate === -1 ? Math.min(text.length, index + length + 160) : endCandidate + 1;
  return text.slice(start, end).trim();
}

export function scanMentionsForScene(novelId: string, sceneId: string) {
  const db = getDb();
  const scene = db.select().from(scenes).where(eq(scenes.id, sceneId)).get();
  if (!scene) return [];
  const text = plainFromTipTap(scene.content);
  const entries = db
    .select()
    .from(knowledgeEntries)
    .where(eq(knowledgeEntries.novelId, novelId))
    .all();

  db.delete(knowledgeAppearances).where(eq(knowledgeAppearances.sceneId, sceneId)).run();

  const found: Array<{ entryId: string; snippet: string }> = [];
  for (const entry of entries) {
    const names = [entry.name, ...(entry.aliases ?? "").split(",").map((a) => a.trim())].filter(
      Boolean,
    );
    for (const name of names) {
      const re = new RegExp(`\\b${escapeRegExp(name)}\\b`, "i");
      const match = re.exec(text);
      if (match) {
        const snippet = contextAround(text, match.index, match[0].length);
        db.insert(knowledgeAppearances)
          .values({
            id: id(),
            entryId: entry.id,
            sceneId,
            contextSnippet: snippet,
            createdAt: now(),
          })
          .run();
        found.push({ entryId: entry.id, snippet });
        break;
      }
    }
  }
  return found;
}

export function knowledgeForSceneText(novelId: string, text: string) {
  const entries = getDb()
    .select()
    .from(knowledgeEntries)
    .where(eq(knowledgeEntries.novelId, novelId))
    .all();
  return entries.filter((entry) => {
    const names = [entry.name, ...(entry.aliases ?? "").split(",").map((a) => a.trim())].filter(
      Boolean,
    );
    return names.some((name) => new RegExp(`\\b${escapeRegExp(name)}\\b`, "i").test(text));
  });
}

export function knowledgeForChapterText(novelId: string, text: string) {
  return knowledgeForSceneText(novelId, text);
}
