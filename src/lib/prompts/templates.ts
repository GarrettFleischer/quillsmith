import { compileTemplate } from "@/lib/prompt";
import { LAYER_TEMPLATE } from "@/lib/prompts/layering";

export const EXPAND_TEMPLATE = `Take into account the following glossary of characters/locations/items/lore when writing your response:
<codex>
{{codex}}
</codex>

{{taskLead}}

{{styleGuide}}

{{sliders}}

{{sceneInstructions}}

Quality bar:
- Match the voice of <currentChapter> (or <previousChapter> if current is empty) before adding flourish.
- Dramatize beats; do not announce them.
- Prefer stopping early over padding once the beats above are covered.
- Do not write events belonging to <nextChapter> or later outline chapters.

Here is additional context to help you with your answer:
<additionalContext>
{{novelMeta}}

Current placement:
Act: {{actTitle}}
Chapter: {{chapterTitle}}
Chapter goal: {{chapterGoal}}
Act brief:
{{actBrief}}

Full outline is available via tools if you need a later chapter. Use the story-so-far summaries for distant continuity instead of raw manuscript dump:
<storySoFar>
{{storySoFar}}
</storySoFar>

Current act outline (continuity and spoiler map only - do not write ahead):
{{currentActOutline}}
</additionalContext>

Neighboring prose:
<previousChapter>
{{previousChapter}}
</previousChapter>

<currentChapter>
{{currentChapter}}
</currentChapter>

Voice anchor (continue from here; do not repeat):
<voiceAnchor>
{{voiceAnchor}}
</voiceAnchor>

<nextChapter>
{{nextChapter}}
</nextChapter>

Mention-relevant knowledge excerpts:
{{mentionedCodex}}

{{knowledge}}

Continue from the end of the current chapter. Cover only the beats/instructions above. Prefer stopping early over padding.`;

/** User message for rewrite: the chapter text to condense. Length target lives in the system prompt. */
export const REWRITE_TEMPLATE = `{{styleGuide}}

Condense the current chapter while matching the author voice above.

<currentChapter>
{{currentChapter}}
</currentChapter>`;

export const DENSITY_TEMPLATE = `Count AI-tell pattern density in this chapter. Return JSON hits only.

<passage>
{{currentChapter}}
</passage>`;

export const SCRUB_TEMPLATE = `Inspect this chapter for the focused tell. Return JSON hits only unless asked to rewrite.

<passage>
{{currentChapter}}
</passage>

{{userInstruction}}`;

export const CHECK_PLAN_TEMPLATE = `Run this single check. Return an improvement plan (JSON). Do not rewrite.

Check: {{checkFocus}}

<passage>
{{currentChapter}}
</passage>`;

export const CHECK_APPLY_TEMPLATE = `Apply this improvement plan. Change nothing else.

<plan>
{{improvementPlan}}
</plan>

<passage>
{{currentChapter}}
</passage>`;

export const BUILTIN_COMMANDS = [
  {
    slug: "expand",
    label: "Expand",
    description:
      "Craft pipeline: curate lore, set sliders, layer models, then run checks — then continue the chapter",
    defaultTemperature: 0.75,
    promptTemplate: EXPAND_TEMPLATE,
    enableTools: "true",
  },
  {
    slug: "rewrite",
    label: "Rewrite",
    description: "Condense the chapter to a target length while matching voice",
    defaultTemperature: 0.35,
    promptTemplate: REWRITE_TEMPLATE,
    enableTools: "false",
  },
  {
    slug: "density",
    label: "Density",
    description: "Count stacked AI-tell patterns in this chapter (not a detector score)",
    defaultTemperature: 0.15,
    promptTemplate: DENSITY_TEMPLATE,
    enableTools: "false",
  },
  {
    slug: "scrub-brochure",
    label: "Scrub brochure",
    description: "Flag travel-guide / press-release language",
    defaultTemperature: 0.2,
    promptTemplate: SCRUB_TEMPLATE,
    enableTools: "false",
  },
  {
    slug: "scrub-metaphors",
    label: "Scrub metaphors",
    description: "Flag stacked metaphors and personification",
    defaultTemperature: 0.2,
    promptTemplate: SCRUB_TEMPLATE,
    enableTools: "false",
  },
  {
    slug: "scrub-lists",
    label: "Scrub list rhythm",
    description: "Flag stacked list-rhythm catalogs",
    defaultTemperature: 0.2,
    promptTemplate: SCRUB_TEMPLATE,
    enableTools: "false",
  },
  {
    slug: "scrub-triples",
    label: "Scrub rule of three",
    description: "Flag mechanical triple lists",
    defaultTemperature: 0.2,
    promptTemplate: SCRUB_TEMPLATE,
    enableTools: "false",
  },
  {
    slug: "scrub-contrast",
    label: "Scrub contrast",
    description: "Flag not-X-but-Y profundity crutches",
    defaultTemperature: 0.2,
    promptTemplate: SCRUB_TEMPLATE,
    enableTools: "false",
  },
  {
    slug: "scrub-commentary",
    label: "Scrub commentary",
    description: "Flag essay-like meaning commentary",
    defaultTemperature: 0.2,
    promptTemplate: SCRUB_TEMPLATE,
    enableTools: "false",
  },
  {
    slug: "scrub-synonyms",
    label: "Scrub synonyms",
    description: "Flag elegant variation / synonym roulette",
    defaultTemperature: 0.2,
    promptTemplate: SCRUB_TEMPLATE,
    enableTools: "false",
  },
  {
    slug: "scrub-verbs",
    label: "Scrub fancy verbs",
    description: "Flag serves-as / stands-as copulas",
    defaultTemperature: 0.2,
    promptTemplate: SCRUB_TEMPLATE,
    enableTools: "false",
  },
  {
    slug: "scrub-emotion",
    label: "Scrub emotion shorthand",
    description: "Flag abstract emotional shorthand",
    defaultTemperature: 0.2,
    promptTemplate: SCRUB_TEMPLATE,
    enableTools: "false",
  },
  {
    slug: "scrub-pivots",
    label: "Scrub pivots",
    description: "Flag repeated clean-pivot sentence tics",
    defaultTemperature: 0.2,
    promptTemplate: SCRUB_TEMPLATE,
    enableTools: "false",
  },
  {
    slug: "check-adverbs",
    label: "Check adverbs",
    description: "Improvement plan for superfluous adverbs — does not rewrite",
    defaultTemperature: 0.15,
    promptTemplate: CHECK_PLAN_TEMPLATE,
    enableTools: "false",
  },
  {
    slug: "check-dialogue-tags",
    label: "Check dialogue tags",
    description: "Improvement plan for said-bookisms and explaining tags",
    defaultTemperature: 0.15,
    promptTemplate: CHECK_PLAN_TEMPLATE,
    enableTools: "false",
  },
  {
    slug: "check-scene-logic",
    label: "Check scene logic",
    description: "Improvement plan for plausibility and chronology holes",
    defaultTemperature: 0.15,
    promptTemplate: CHECK_PLAN_TEMPLATE,
    enableTools: "false",
  },
  {
    slug: "check-contrast",
    label: "Check not-X-but-Y",
    description: "Improvement plan for contrast crutches",
    defaultTemperature: 0.15,
    promptTemplate: CHECK_PLAN_TEMPLATE,
    enableTools: "false",
  },
  {
    slug: "layer",
    label: "Layer scene",
    description: "Same craft pipeline as Expand (brief → dialogue → prose → climax → checks)",
    defaultTemperature: 0.7,
    promptTemplate: LAYER_TEMPLATE,
    enableTools: "true",
  },
] as const;

export const PROSE_TEMPLATE_PLACEHOLDERS = [
  "codex",
  "mentionedCodex",
  "taskLead",
  "sceneInstructions",
  "novelMeta",
  "outline",
  "storySoFar",
  "currentActOutline",
  "styleGuide",
  "sliders",
  "checkFocus",
  "improvementPlan",
  "actTitle",
  "chapterTitle",
  "chapterGoal",
  "chapterBeats",
  "chapterSummary",
  "actBrief",
  "previousChapter",
  "currentChapter",
  "nextChapter",
  "previousScene",
  "currentScene",
  "voiceAnchor",
  "nextScene",
  "chapterText",
  "novelPremise",
  "knowledge",
  "selection",
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
