import { AI_TELL_BY_ID, AI_TELLS, type AiTellId } from "@/lib/ai-tells";
import { CHECKS, isCheckId, type CheckId } from "@/lib/checks";
import {
  ANALYZE_COMP_PROMPT,
  ANALYZE_STYLE_PROMPT,
  COACH_BETA_PROMPT,
  COACH_CRITIQUE_PROMPT,
  COACH_INTERVIEW_PROMPT,
  COACH_OUTLINE_VARIANTS_PROMPT,
  COACH_REVERSE_OUTLINE_PROMPT,
  COACH_TUTOR_PROMPT,
  COMPARE_MODELS_PROMPT,
  SUMMARIZE_ACT_PROMPT,
  SUMMARIZE_CHAPTER_PROMPT,
} from "@/lib/prompts/coach";
import { checkApplySystem, checkPlanSystem, COACH_PHYSICS_PROMPT } from "@/lib/prompts/checks";
import {
  LAYER_BRIEF_PROMPT,
  LAYER_CLIMAX_PROMPT,
  LAYER_DIALOGUE_PROMPT,
  LAYER_PROSE_PROMPT,
} from "@/lib/prompts/layering";
import { CURATE_CONTEXT_PROMPT } from "@/lib/prompts/pipeline";
import {
  OVERVIEW_SYSTEM_PROMPT,
  PROSE_SYSTEM_PROMPT,
  REWRITE_SYSTEM_PROMPT,
  SUMMARY_SYSTEM_PROMPT,
  CHAPTER_CHAT_SYSTEM_PROMPT,
} from "@/lib/prompts/rules";
import {
  densityScanSystem,
  identifyScrubberSystem,
  rewriteScrubberSystem,
} from "@/lib/prompts/scrubbers";
import { OVERVIEW_TOOLS, PROSE_TOOLS, CHAPTER_CHAT_TOOLS, type ToolDef } from "@/lib/tools";

export type AiTaskId =
  | "prose_expand"
  | "prose_rewrite"
  | "overview_fill"
  | "overview_review"
  | "overview_outline_variants"
  | "coach_interview"
  | "coach_critique"
  | "coach_tutor"
  | "coach_reverse_outline"
  | "coach_beta"
  | "coach_physics"
  | "scrub_metaphor_stacking"
  | "scrub_list_rhythm_stacking"
  | "scrub_rule_of_three"
  | "scrub_contrast_structures"
  | "scrub_brochure_language"
  | "scrub_meaning_commentary"
  | "scrub_elegant_variation"
  | "scrub_fake_fancy_verbs"
  | "scrub_emotional_shorthand"
  | "scrub_clean_pivot_tics"
  | "check_adverbs"
  | "check_dialogue_tags"
  | "check_scene_logic"
  | "check_contrast"
  | "check_apply"
  | "analyze_density"
  | "summarize_chapter"
  | "summarize_act"
  | "summarize_kb"
  | "analyze_style"
  | "analyze_comp"
  | "compare_models"
  | "curate_context"
  | "layer_brief"
  | "layer_dialogue"
  | "layer_prose"
  | "layer_climax"
  | "chapter_chat";

export type AiOutputMode = "prose" | "markdown_feedback" | "structured_json";

export type AiTaskDef = {
  id: AiTaskId;
  label: string;
  description: string;
  outputMode: AiOutputMode;
  defaultModel: string;
  temperature: number;
  tools: "prose" | "overview" | "chapter" | "none";
  writesScene: boolean;
  group: "draft" | "overview" | "coach" | "scrub" | "check" | "layer" | "context" | "meta";
};

const CHEAP_DEFAULT = "openai/gpt-4o-mini";
const PROSE_DEFAULT = "anthropic/claude-sonnet-4";
const GEMINI_FLASH = "google/gemini-2.5-flash";
const GROK_DEFAULT = "x-ai/grok-4";

function scrubTask(id: AiTellId): AiTaskDef {
  const tell = AI_TELL_BY_ID[id];
  return {
    id: `scrub_${id}` as AiTaskId,
    label: `Scrub: ${tell.label}`,
    description: tell.description,
    outputMode: "structured_json",
    defaultModel: CHEAP_DEFAULT,
    temperature: 0.2,
    tools: "none",
    writesScene: false,
    group: "scrub",
  };
}

function checkTask(id: CheckId): AiTaskDef {
  const check = CHECKS.find((c) => c.id === id)!;
  return {
    id: `check_${id}` as AiTaskId,
    label: `Check: ${check.label}`,
    description: check.description,
    outputMode: "structured_json",
    defaultModel: CHEAP_DEFAULT,
    temperature: 0.15,
    tools: "none",
    writesScene: false,
    group: "check",
  };
}

export const AI_TASKS: AiTaskDef[] = [
  {
    id: "prose_expand",
    label: "Expand scene",
    description: "Craft pipeline: curate context, sliders, layered models, then checks",
    outputMode: "prose",
    defaultModel: PROSE_DEFAULT,
    temperature: 0.75,
    tools: "prose",
    writesScene: true,
    group: "draft",
  },
  {
    id: "prose_rewrite",
    label: "Rewrite / condense",
    description: "Condense the scene to a target length",
    outputMode: "prose",
    defaultModel: PROSE_DEFAULT,
    temperature: 0.35,
    tools: "none",
    writesScene: true,
    group: "draft",
  },
  {
    id: "overview_fill",
    label: "Overview fill",
    description: "Fill unanswered planning questions",
    outputMode: "markdown_feedback",
    defaultModel: PROSE_DEFAULT,
    temperature: 0.5,
    tools: "overview",
    writesScene: false,
    group: "overview",
  },
  {
    id: "overview_review",
    label: "Overview review",
    description: "Coherence audit of the outline",
    outputMode: "markdown_feedback",
    defaultModel: PROSE_DEFAULT,
    temperature: 0.4,
    tools: "overview",
    writesScene: false,
    group: "overview",
  },
  {
    id: "overview_outline_variants",
    label: "Outline variants",
    description: "Propose 2–3 arrangements of existing ideas",
    outputMode: "markdown_feedback",
    defaultModel: PROSE_DEFAULT,
    temperature: 0.55,
    tools: "none",
    writesScene: false,
    group: "overview",
  },
  {
    id: "coach_interview",
    label: "Interview",
    description: "Pull the scene out of the author's head, one question at a time",
    outputMode: "markdown_feedback",
    defaultModel: PROSE_DEFAULT,
    temperature: 0.6,
    tools: "none",
    writesScene: false,
    group: "coach",
  },
  {
    id: "coach_critique",
    label: "Critique",
    description: "Show possible problems; author judges",
    outputMode: "markdown_feedback",
    defaultModel: CHEAP_DEFAULT,
    temperature: 0.3,
    tools: "none",
    writesScene: false,
    group: "coach",
  },
  {
    id: "coach_tutor",
    label: "Practice",
    description: "Exemplar comparison and one micro-exercise",
    outputMode: "markdown_feedback",
    defaultModel: PROSE_DEFAULT,
    temperature: 0.5,
    tools: "none",
    writesScene: false,
    group: "coach",
  },
  {
    id: "coach_reverse_outline",
    label: "Reverse outline",
    description: "What each part of the chapter is doing",
    outputMode: "markdown_feedback",
    defaultModel: CHEAP_DEFAULT,
    temperature: 0.3,
    tools: "none",
    writesScene: false,
    group: "coach",
  },
  {
    id: "coach_beta",
    label: "Beta readers",
    description: "Simulated reader personas; possible problems to investigate",
    outputMode: "markdown_feedback",
    defaultModel: CHEAP_DEFAULT,
    temperature: 0.55,
    tools: "none",
    writesScene: false,
    group: "coach",
  },
  {
    id: "coach_physics",
    label: "Narrative physics",
    description: "Propose scene and character slider positions — not prose",
    outputMode: "structured_json",
    defaultModel: CHEAP_DEFAULT,
    temperature: 0.2,
    tools: "none",
    writesScene: false,
    group: "coach",
  },
  ...AI_TELLS.map((t) => scrubTask(t.id)),
  ...CHECKS.map((c) => checkTask(c.id)),
  {
    id: "check_apply",
    label: "Apply check plan",
    description: "Change only what the improvement plan lists",
    outputMode: "prose",
    defaultModel: CHEAP_DEFAULT,
    temperature: 0.25,
    tools: "none",
    writesScene: false,
    group: "check",
  },
  {
    id: "analyze_density",
    label: "Pattern density",
    description: "Count AI-tell patterns in a passage",
    outputMode: "structured_json",
    defaultModel: CHEAP_DEFAULT,
    temperature: 0.15,
    tools: "none",
    writesScene: false,
    group: "scrub",
  },
  {
    id: "summarize_chapter",
    label: "Chapter summary",
    description: "Structured chapter rollup for later context",
    outputMode: "prose",
    defaultModel: CHEAP_DEFAULT,
    temperature: 0.3,
    tools: "none",
    writesScene: false,
    group: "context",
  },
  {
    id: "summarize_act",
    label: "Act summary",
    description: "Act-level rollup from chapter summaries",
    outputMode: "prose",
    defaultModel: CHEAP_DEFAULT,
    temperature: 0.3,
    tools: "none",
    writesScene: false,
    group: "context",
  },
  {
    id: "summarize_kb",
    label: "Knowledge summary",
    description: "Update a story-bible entry from appearances",
    outputMode: "prose",
    defaultModel: CHEAP_DEFAULT,
    temperature: 0.3,
    tools: "none",
    writesScene: false,
    group: "context",
  },
  {
    id: "analyze_style",
    label: "Analyze style",
    description: "Extract a living style guide from samples",
    outputMode: "structured_json",
    defaultModel: PROSE_DEFAULT,
    temperature: 0.35,
    tools: "none",
    writesScene: false,
    group: "context",
  },
  {
    id: "analyze_comp",
    label: "Comp analysis",
    description: "Genre grammar from a comparison book — not a plot to copy",
    outputMode: "markdown_feedback",
    defaultModel: PROSE_DEFAULT,
    temperature: 0.4,
    tools: "none",
    writesScene: false,
    group: "overview",
  },
  {
    id: "compare_models",
    label: "Compare models",
    description: "Run the same small task across models",
    outputMode: "markdown_feedback",
    defaultModel: CHEAP_DEFAULT,
    temperature: 0.5,
    tools: "none",
    writesScene: false,
    group: "meta",
  },
  {
    id: "curate_context",
    label: "Curate scene context",
    description: "Pick which lore belongs in this scene's prompt",
    outputMode: "structured_json",
    defaultModel: CHEAP_DEFAULT,
    temperature: 0.1,
    tools: "none",
    writesScene: false,
    group: "context",
  },
  {
    id: "layer_brief",
    label: "Layer: scene brief",
    description: "Structure the scene before anyone writes prose",
    outputMode: "markdown_feedback",
    defaultModel: GEMINI_FLASH,
    temperature: 0.4,
    tools: "none",
    writesScene: false,
    group: "layer",
  },
  {
    id: "layer_dialogue",
    label: "Layer: dialogue draft",
    description: "Dialogue-only draft with light blocking",
    outputMode: "prose",
    defaultModel: GROK_DEFAULT,
    temperature: 0.8,
    tools: "none",
    writesScene: false,
    group: "layer",
  },
  {
    id: "layer_prose",
    label: "Layer: fill prose",
    description: "Narrative connective tissue around dialogue",
    outputMode: "prose",
    defaultModel: GEMINI_FLASH,
    temperature: 0.7,
    tools: "none",
    writesScene: false,
    group: "layer",
  },
  {
    id: "layer_climax",
    label: "Layer: climax polish",
    description: "Dramatic remaining beats and unify the scene",
    outputMode: "prose",
    defaultModel: PROSE_DEFAULT,
    temperature: 0.7,
    tools: "prose",
    writesScene: true,
    group: "layer",
  },
  {
    id: "chapter_chat",
    label: "Chapter chat",
    description: "Plan this chapter: summary, beats, and Codex-aware questions",
    outputMode: "markdown_feedback",
    defaultModel: PROSE_DEFAULT,
    temperature: 0.4,
    tools: "chapter",
    writesScene: false,
    group: "draft",
  },
];

export const AI_TASK_BY_ID: Record<AiTaskId, AiTaskDef> = Object.fromEntries(
  AI_TASKS.map((t) => [t.id, t]),
) as Record<AiTaskId, AiTaskDef>;

export function isAiTaskId(value: string): value is AiTaskId {
  return value in AI_TASK_BY_ID;
}

export function toolsForTask(task: AiTaskDef): ToolDef[] | undefined {
  if (task.tools === "prose") return PROSE_TOOLS;
  if (task.tools === "overview") return OVERVIEW_TOOLS;
  if (task.tools === "chapter") return CHAPTER_CHAT_TOOLS;
  return undefined;
}

export function systemPromptForTask(
  taskId: AiTaskId,
  opts?: {
    scrubMode?: "identify" | "rewrite";
    tellId?: AiTellId;
    checkId?: CheckId;
    checkMode?: "plan" | "apply";
  },
): string {
  switch (taskId) {
    case "prose_expand":
      return PROSE_SYSTEM_PROMPT;
    case "prose_rewrite":
      return REWRITE_SYSTEM_PROMPT;
    case "chapter_chat":
      return CHAPTER_CHAT_SYSTEM_PROMPT;
    case "overview_fill":
    case "overview_review":
      return OVERVIEW_SYSTEM_PROMPT;
    case "overview_outline_variants":
      return COACH_OUTLINE_VARIANTS_PROMPT;
    case "coach_interview":
      return COACH_INTERVIEW_PROMPT;
    case "coach_critique":
      return COACH_CRITIQUE_PROMPT;
    case "coach_tutor":
      return COACH_TUTOR_PROMPT;
    case "coach_reverse_outline":
      return COACH_REVERSE_OUTLINE_PROMPT;
    case "coach_beta":
      return COACH_BETA_PROMPT;
    case "coach_physics":
      return COACH_PHYSICS_PROMPT;
    case "analyze_density":
      return densityScanSystem();
    case "summarize_chapter":
      return SUMMARIZE_CHAPTER_PROMPT;
    case "summarize_act":
      return SUMMARIZE_ACT_PROMPT;
    case "summarize_kb":
      return SUMMARY_SYSTEM_PROMPT;
    case "analyze_style":
      return ANALYZE_STYLE_PROMPT;
    case "analyze_comp":
      return ANALYZE_COMP_PROMPT;
    case "compare_models":
      return COMPARE_MODELS_PROMPT;
    case "curate_context":
      return CURATE_CONTEXT_PROMPT;
    case "check_apply":
      return checkApplySystem();
    case "layer_brief":
      return LAYER_BRIEF_PROMPT;
    case "layer_dialogue":
      return LAYER_DIALOGUE_PROMPT;
    case "layer_prose":
      return LAYER_PROSE_PROMPT;
    case "layer_climax":
      return LAYER_CLIMAX_PROMPT;
    default: {
      if (taskId.startsWith("scrub_")) {
        const tellId = taskId.replace("scrub_", "") as AiTellId;
        const tell = AI_TELL_BY_ID[tellId];
        if (!tell) return densityScanSystem();
        return opts?.scrubMode === "rewrite"
          ? rewriteScrubberSystem(tell)
          : identifyScrubberSystem(tell);
      }
      if (taskId.startsWith("check_")) {
        const checkId = (opts?.checkId ?? taskId.slice("check_".length)) as CheckId;
        if (opts?.checkMode === "apply") return checkApplySystem();
        if (isCheckId(checkId)) return checkPlanSystem(checkId);
      }
      return PROSE_SYSTEM_PROMPT;
    }
  }
}

const SLUG_FOR_TELL: Record<AiTellId, string> = {
  metaphor_stacking: "metaphors",
  list_rhythm_stacking: "lists",
  rule_of_three: "triples",
  contrast_structures: "contrast",
  brochure_language: "brochure",
  meaning_commentary: "commentary",
  elegant_variation: "synonyms",
  fake_fancy_verbs: "verbs",
  emotional_shorthand: "emotion",
  clean_pivot_tics: "pivots",
};

const TELL_FOR_SLUG: Record<string, AiTellId> = Object.fromEntries(
  Object.entries(SLUG_FOR_TELL).map(([id, slug]) => [slug, id as AiTellId]),
) as Record<string, AiTellId>;

export { commandKind, type CommandKind } from "@/lib/command-kind";

export function commandSlugToTask(slug: string): AiTaskId | null {
  if (slug === "expand" || slug.startsWith("expand-")) return "prose_expand";
  if (slug === "rewrite" || slug.startsWith("rewrite-")) return "prose_rewrite";
  if (slug === "density") return "analyze_density";
  if (slug === "layer") return "layer_climax";
  if (slug.startsWith("scrub-")) {
    const key = slug.slice("scrub-".length);
    const tellId = TELL_FOR_SLUG[key];
    if (tellId) return `scrub_${tellId}` as AiTaskId;
  }
  if (slug.startsWith("check-")) {
    const key = slug.slice("check-".length).replaceAll("-", "_");
    if (isCheckId(key)) return `check_${key}` as AiTaskId;
  }
  return null;
}

export function checkIdFromTask(taskId: AiTaskId): CheckId | null {
  if (!taskId.startsWith("check_")) return null;
  const id = taskId.slice("check_".length);
  return isCheckId(id) ? id : null;
}

export function scrubSlugForTell(id: AiTellId): string {
  return `scrub-${SLUG_FOR_TELL[id]}`;
}

export function tellIdFromScrubTask(taskId: AiTaskId): AiTellId | null {
  if (!taskId.startsWith("scrub_")) return null;
  const id = taskId.slice("scrub_".length);
  return id in AI_TELL_BY_ID ? (id as AiTellId) : null;
}
