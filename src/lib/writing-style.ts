import { getSettings } from "@/lib/novels";
import {
  formatStyleGuideBlock,
  mergeStyleGuides,
  parseStyleGuide,
} from "@/lib/prompts/style-guide";

/** Author voice from Settings, plus an optional book overlay from Codex Story. */
export function resolveWritingStyleGuide(novelStyleJson?: string | null): string {
  const settings = getSettings();
  const merged = mergeStyleGuides(
    parseStyleGuide(settings.authorStyleGuideJson),
    parseStyleGuide(novelStyleJson),
  );
  if (!merged) return "";
  return formatStyleGuideBlock(merged);
}
