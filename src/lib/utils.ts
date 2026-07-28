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
