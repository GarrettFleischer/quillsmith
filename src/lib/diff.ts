import { diffWords } from "diff";

export type DiffHunk = {
  id: string;
  type: "equal" | "change" | "insert" | "delete";
  original: string;
  revised: string;
  accepted?: "new" | "original" | null;
};

export function buildRewriteHunks(original: string, revised: string): DiffHunk[] {
  const parts = diffWords(original, revised);
  const hunks: DiffHunk[] = [];
  let i = 0;
  while (i < parts.length) {
    const part = parts[i];
    if (!part.added && !part.removed) {
      hunks.push({
        id: `h${hunks.length}`,
        type: "equal",
        original: part.value,
        revised: part.value,
        accepted: null,
      });
      i += 1;
      continue;
    }
    if (part.removed && parts[i + 1]?.added) {
      hunks.push({
        id: `h${hunks.length}`,
        type: "change",
        original: part.value,
        revised: parts[i + 1].value,
        accepted: null,
      });
      i += 2;
      continue;
    }
    if (part.removed) {
      hunks.push({
        id: `h${hunks.length}`,
        type: "delete",
        original: part.value,
        revised: "",
        accepted: null,
      });
      i += 1;
      continue;
    }
    hunks.push({
      id: `h${hunks.length}`,
      type: "insert",
      original: "",
      revised: part.value,
      accepted: null,
    });
    i += 1;
  }
  return hunks;
}

export function applyHunkDecisions(hunks: DiffHunk[]): string {
  return hunks
    .map((h) => {
      if (h.type === "equal") return h.revised;
      const choice = h.accepted ?? "new";
      if (choice === "original") return h.original;
      return h.revised;
    })
    .join("");
}
