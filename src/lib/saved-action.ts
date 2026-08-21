export type SavedAction = {
  id: string;
  slug: string;
  label: string;
  description: string | null;
  defaultTemperature: number;
  promptTemplate: string;
  enableTools: string;
  builtIn: boolean;
};

export const PRIMARY_ACTION_VARS = [
  "mentionedCodex",
  "selection",
  "chapterSummary",
  "chapterBeats",
  "currentChapter",
  "userInstruction",
  "codex",
] as const;

export const NEW_ACTION_DRAFT: SavedAction = {
  id: "",
  slug: "",
  label: "",
  description: "",
  defaultTemperature: 0.7,
  promptTemplate:
    "Instruction: {{userInstruction}}\n\nSelection:\n{{selection}}\n\nChapter:\n{{currentChapter}}\n\nMentioned Codex:\n{{mentionedCodex}}",
  enableTools: "true",
  builtIn: false,
};
