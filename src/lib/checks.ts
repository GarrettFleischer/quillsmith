export type CheckId = "adverbs" | "dialogue_tags" | "scene_logic" | "contrast";

export type ImprovementItem = {
  quote: string;
  issue: string;
  change: string;
};

export type ImprovementPlan = {
  checkId: CheckId;
  items: ImprovementItem[];
};

export type CheckDef = {
  id: CheckId;
  label: string;
  description: string;
  focus: string;
};

export const CHECKS: CheckDef[] = [
  {
    id: "adverbs",
    label: "Superfluous adverbs",
    description: "Flag -ly padding and weak verb + adverb pairs",
    focus: "superfluous adverbs and weak verb+adverb pairs. Ignore adverbs that carry meaning the verb cannot.",
  },
  {
    id: "dialogue_tags",
    label: "Dialogue tags",
    description: "Flag said-bookisms, stacked tags, and tags that explain the line",
    focus: "dialogue tags: said-bookisms, adverbial tags, tags that explain what the line already shows, and tags that can be dropped because action or speech rhythm already attributes the speaker.",
  },
  {
    id: "scene_logic",
    label: "Logic & plausibility",
    description: "Flag chronology, blocking, and cause-effect holes in this scene only",
    focus: "scene logic and plausibility: who is where, what they could know, whether an action follows from the prior beat, and physical/chronology holes. Do not invent later-plot solutions.",
  },
  {
    id: "contrast",
    label: "Not-X-but-Y crutches",
    description: "Flag 'it's not just this, but also that' profundity",
    focus: "contrast crutches: 'not X but Y', 'it's not just… it's…', and similar profundity templates. Suggest a direct line instead.",
  },
];

export const CHECK_BY_ID: Record<CheckId, CheckDef> = Object.fromEntries(
  CHECKS.map((c) => [c.id, c]),
) as Record<CheckId, CheckDef>;

export function isCheckId(value: string): value is CheckId {
  return value in CHECK_BY_ID;
}

export function parseImprovementPlan(raw: unknown, fallbackId: CheckId): ImprovementPlan {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const itemsRaw = Array.isArray(obj.items) ? obj.items : [];
  const items: ImprovementItem[] = [];
  for (const item of itemsRaw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const quote = String(row.quote ?? "").trim();
    const issue = String(row.issue ?? "").trim();
    const change = String(row.change ?? "").trim();
    if (!quote && !change) continue;
    items.push({ quote, issue, change });
  }
  const checkId = isCheckId(String(obj.checkId ?? "")) ? (obj.checkId as CheckId) : fallbackId;
  return { checkId, items };
}

export function formatPlanMarkdown(plan: ImprovementPlan): string {
  if (plan.items.length === 0) return "No issues found for this check.";
  return plan.items
    .map((item, i) => {
      const lines = [`${i + 1}. "${item.quote || "(no quote)"}"`];
      if (item.issue) lines.push(`   Issue: ${item.issue}`);
      if (item.change) lines.push(`   Change: ${item.change}`);
      return lines.join("\n");
    })
    .join("\n\n");
}

export function slugForCheck(id: CheckId): string {
  return `check-${id.replaceAll("_", "-")}`;
}

export function checkIdFromSlug(slug: string): CheckId | null {
  if (!slug.startsWith("check-")) return null;
  const key = slug.slice("check-".length).replaceAll("-", "_");
  return isCheckId(key) ? key : null;
}
