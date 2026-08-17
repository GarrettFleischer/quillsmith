import { AI_TELLS, type AiTellId } from "@/lib/ai-tells";

export type DensityLevel = "low" | "elevated" | "high";

export type TellHit = {
  quote: string;
  pattern: AiTellId;
  why: string;
  suggestion: string;
};

export type DensityThresholds = {
  elevatedTotalPer1k: number;
  highTotalPer1k: number;
  elevatedSingle: number;
  highMetaphor: number;
  highListRhythm: number;
};

export const DEFAULT_DENSITY_THRESHOLDS: DensityThresholds = {
  elevatedTotalPer1k: 15,
  highTotalPer1k: 25,
  elevatedSingle: 4,
  highMetaphor: 6,
  highListRhythm: 4,
};

export type TellCount = {
  id: AiTellId;
  label: string;
  count: number;
  per1k: number;
  level: DensityLevel;
};

export type DensityReport = {
  wordCount: number;
  totalHits: number;
  hitsPer1k: number;
  level: DensityLevel;
  byTell: TellCount[];
  hits: TellHit[];
};

export function parseDensityThresholds(json?: string | null): DensityThresholds {
  if (!json) return DEFAULT_DENSITY_THRESHOLDS;
  try {
    const parsed = JSON.parse(json) as Partial<DensityThresholds>;
    return { ...DEFAULT_DENSITY_THRESHOLDS, ...parsed };
  } catch {
    return DEFAULT_DENSITY_THRESHOLDS;
  }
}

export function wordCount(text: string): number {
  const parts = text.trim().split(/\s+/).filter(Boolean);
  return parts.length;
}

export function parseTellHits(raw: unknown): TellHit[] {
  if (!raw || typeof raw !== "object") return [];
  const hits = (raw as { hits?: unknown }).hits;
  if (!Array.isArray(hits)) return [];
  const valid = new Set(AI_TELLS.map((t) => t.id));
  return hits.flatMap((h) => {
    if (!h || typeof h !== "object") return [];
    const rec = h as Record<string, unknown>;
    const pattern = String(rec.pattern ?? "");
    if (!valid.has(pattern as AiTellId)) return [];
    const quote = String(rec.quote ?? "").trim();
    if (!quote) return [];
    return [
      {
        quote,
        pattern: pattern as AiTellId,
        why: String(rec.why ?? "").trim(),
        suggestion: String(rec.suggestion ?? "").trim(),
      },
    ];
  });
}

function levelForTell(
  id: AiTellId,
  count: number,
  thresholds: DensityThresholds,
): DensityLevel {
  if (id === "metaphor_stacking" && count >= thresholds.highMetaphor) return "high";
  if (id === "list_rhythm_stacking" && count >= thresholds.highListRhythm) return "high";
  if (count >= thresholds.elevatedSingle) return "elevated";
  return "low";
}

export function analyzePassageDensity(
  plainText: string,
  hits: TellHit[],
  thresholds: DensityThresholds = DEFAULT_DENSITY_THRESHOLDS,
): DensityReport {
  const words = Math.max(1, wordCount(plainText));
  const counts = Object.fromEntries(AI_TELLS.map((t) => [t.id, 0])) as Record<AiTellId, number>;
  for (const hit of hits) {
    counts[hit.pattern] += 1;
  }
  const totalHits = hits.length;
  const hitsPer1k = (totalHits / words) * 1000;
  const byTell: TellCount[] = AI_TELLS.map((t) => {
    const count = counts[t.id];
    return {
      id: t.id,
      label: t.label,
      count,
      per1k: (count / words) * 1000,
      level: levelForTell(t.id, count, thresholds),
    };
  }).sort((a, b) => b.count - a.count);

  let level: DensityLevel = "low";
  const scaledTotal = (totalHits / words) * 1000;
  if (
    scaledTotal >= thresholds.highTotalPer1k ||
    counts.metaphor_stacking >= thresholds.highMetaphor ||
    counts.list_rhythm_stacking >= thresholds.highListRhythm
  ) {
    level = "high";
  } else if (
    scaledTotal >= thresholds.elevatedTotalPer1k ||
    byTell.some((t) => t.count >= thresholds.elevatedSingle)
  ) {
    level = "elevated";
  }

  return {
    wordCount: wordCount(plainText),
    totalHits,
    hitsPer1k,
    level,
    byTell,
    hits,
  };
}

export function densityDisclaimer(): string {
  return "These patterns appear in human writing too. Density — the same tell repeated often in a short passage — is what makes prose feel machine-generated. You decide what is a real problem.";
}
