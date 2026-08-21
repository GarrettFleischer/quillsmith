import { nanoid } from "nanoid";

export function id() {
  return nanoid();
}

export function now() {
  return new Date();
}

export const EMPTY_DOC = JSON.stringify({
  type: "doc",
  content: [{ type: "paragraph" }],
});

export function plainFromTipTap(json: string): string {
  try {
    const doc = JSON.parse(json) as {
      content?: Array<{ type?: string; content?: Array<{ text?: string }>; attrs?: Record<string, unknown> }>;
    };
    const parts: string[] = [];
    const walk = (nodes?: typeof doc.content) => {
      if (!nodes) return;
      for (const node of nodes) {
        if (node.type === "text" && "text" in node) {
          parts.push(String((node as { text?: string }).text ?? ""));
        }
        if (node.content) walk(node.content as typeof doc.content);
        if (node.type === "paragraph" || node.type === "heading") parts.push("\n\n");
      }
    };
    walk(doc.content);
    return parts.join("").replace(/\n{3,}/g, "\n\n").trim();
  } catch {
    return json;
  }
}

export function tipTapFromPlain(text: string): string {
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  return JSON.stringify({
    type: "doc",
    content:
      paragraphs.length === 0
        ? [{ type: "paragraph" }]
        : paragraphs.map((p) => ({
            type: "paragraph",
            content: p ? [{ type: "text", text: p }] : [],
          })),
  });
}

type TipTapNode = {
  type?: string;
  content?: TipTapNode[];
  text?: string;
  attrs?: Record<string, unknown>;
};

function headingNode(text: string): TipTapNode {
  return {
    type: "heading",
    attrs: { level: 2 },
    content: text ? [{ type: "text", text }] : [],
  };
}

export function isGenericSceneTitle(title: string | null | undefined): boolean {
  const t = (title ?? "").trim().toLowerCase();
  return !t || t === "new scene" || /^scene\s*\d*$/i.test(t);
}

/** Merge TipTap documents, optionally inserting leftover scene titles as headings. */
export function mergeTipTapDocs(
  parts: Array<{ json: string; heading?: string | null }>,
): string {
  const content: TipTapNode[] = [];
  for (const part of parts) {
    if (part.heading?.trim() && !isGenericSceneTitle(part.heading)) {
      content.push(headingNode(part.heading.trim()));
    }
    try {
      const doc = JSON.parse(part.json) as TipTapNode;
      if (!Array.isArray(doc.content)) continue;
      for (const node of doc.content) {
        if (node.type === "paragraph" && (!node.content || node.content.length === 0)) {
          continue;
        }
        content.push(node);
      }
    } catch {
      const plain = part.json.trim();
      if (plain) {
        content.push({
          type: "paragraph",
          content: [{ type: "text", text: plain }],
        });
      }
    }
  }
  return JSON.stringify({
    type: "doc",
    content: content.length ? content : [{ type: "paragraph" }],
  });
}
