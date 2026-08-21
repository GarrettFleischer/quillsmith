/** Client-safe slash-command routing (no server/db imports). */

export type CommandKind = "expand" | "rewrite" | "feedback" | "check" | "layer";

export function commandKind(slug: string): CommandKind {
  if (slug === "layer") return "layer";
  if (slug.startsWith("check-")) return "check";
  if (slug === "expand" || slug.startsWith("expand-")) return "expand";
  if (slug === "rewrite" || slug.startsWith("rewrite-")) return "rewrite";
  return "feedback";
}
