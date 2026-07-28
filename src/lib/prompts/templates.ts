import { compileTemplate } from "@/lib/prompt";

export const EXPAND_TEMPLATE = `Take into account the following glossary of characters/locations/items/lore when writing your response:
<codex>
{{codex}}
</codex>

{{taskLead}}

{{sceneInstructions}}

Here is additional context to help you with your answer:
<additionalContext>
{{novelMeta}}

Current placement:
Act: {{actTitle}}
Chapter: {{chapterTitle}}
Chapter goal: {{chapterGoal}}
{{outline}}
</additionalContext>

Neighboring prose (for continuity only — do not rewrite unless instructed):
<previousScene>
{{previousScene}}
</previousScene>

<currentScene>
{{currentScene}}
</currentScene>

<nextScene>
{{nextScene}}
</nextScene>

Mention-relevant knowledge excerpts:
{{knowledge}}

Continue from the end of the current scene. Cover only the beats/instructions above. Prefer stopping early over padding.`;

/** User message for /rewrite: the scene text to condense. Length target lives in the system prompt. */
export const REWRITE_TEMPLATE = `{{currentScene}}`;

export const BUILTIN_COMMANDS = [
  {
    slug: "expand",
    label: "Expand",
    description: "Continue the scene from beats with craft + anti-slop guards",
    defaultTemperature: 0.8,
    promptTemplate: EXPAND_TEMPLATE,
    enableTools: "true",
  },
  {
    slug: "rewrite",
    label: "Rewrite",
    description: "Condense the scene to a target length while matching voice",
    defaultTemperature: 0.4,
    promptTemplate: REWRITE_TEMPLATE,
    enableTools: "false",
  },
] as const;

export const PROSE_TEMPLATE_PLACEHOLDERS = [
  "codex",
  "taskLead",
  "sceneInstructions",
  "novelMeta",
  "outline",
  "actTitle",
  "chapterTitle",
  "chapterGoal",
  "chapterBeats",
  "previousScene",
  "currentScene",
  "nextScene",
  "chapterText",
  "actBrief",
  "novelPremise",
  "knowledge",
  "userInstruction",
  "lengthInstructions",
] as const;

/** Helper for settings UI / docs: show what a bag compiles to. */
export function previewTemplate(
  template: string,
  bag: Record<string, string | undefined | null>,
): string {
  return compileTemplate(template, bag);
}
