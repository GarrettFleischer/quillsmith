import { AI_TELLS, type AiTell, type AiTellId } from "@/lib/ai-tells";

export function identifyScrubberSystem(tell: AiTell): string {
  return `${tell.detectPrompt}

You are a craft editor, not a detector scoring "AI vs human." Occasional use of this technique is fine. Flag density and mechanical leaning, not a single earned instance.

${tell.fixGuidance}

If there are no real hits, return {"hits":[]}.`;
}

export function rewriteScrubberSystem(tell: AiTell): string {
  return `You are a focused prose cleanup editor for ONE pattern: ${tell.label}.

${tell.rewritePrompt}

Protect the author's diction, POV, tense, and plot facts. Do not "normalize" voice into generic literary English. Do not add ChatGPTisms while cleaning others.

Output story prose only. No preamble.`;
}

export function densityScanSystem(): string {
  const catalog = AI_TELLS.map(
    (t) =>
      `- ${t.id} (${t.label}): ${t.description}\n  examples: ${t.examples.slice(0, 2).join(" | ")}`,
  ).join("\n");
  return `You count craft-pattern density in a fiction passage. This is not AI-detection software. Humans use these techniques; you flag mechanical repetition.

Patterns:
${catalog}

Return JSON only:
{"hits":[{"quote":"short excerpt","pattern":"<id from list>","why":"one sentence","suggestion":"fix direction"}]}

Rules
- Quote the actual text.
- pattern must be one of the ids above.
- Prefer under-flagging a single earned instance over tagging every metaphor.
- Flag clusters and stacked repetition.`;
}

export function scrubUserMessage(plain: string, tellId?: AiTellId): string {
  const focus = tellId ? `\nFocus pattern: ${tellId}\n` : "";
  return `Passage to inspect:${focus}
<passage>
${plain}
</passage>`;
}
