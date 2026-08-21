export const CODEX_TYPES = ["character", "lore", "location", "item", "other"] as const;
export type CodexType = (typeof CODEX_TYPES)[number];

export const CODEX_TYPE_PLURAL: Record<CodexType, string> = {
  character: "Characters",
  lore: "Lore",
  location: "Locations",
  item: "Items",
  other: "Others",
};

export const CODEX_TYPE_SINGULAR: Record<CodexType, string> = {
  character: "Character",
  lore: "Lore",
  location: "Location",
  item: "Item",
  other: "Other",
};

export function normalizeCodexType(type: string): CodexType {
  const raw = type === "place" ? "location" : type;
  return CODEX_TYPES.includes(raw as CodexType) ? (raw as CodexType) : "other";
}

export function entrySnippet(summary: string | null, notes: string | null) {
  const text = (summary || notes || "").replace(/\s+/g, " ").trim();
  if (!text) return "No description yet";
  return text.length > 92 ? `${text.slice(0, 90).trim()}…` : text;
}

export function wordCount(text: string) {
  const parts = text.trim().split(/\s+/).filter(Boolean);
  return parts.length;
}
