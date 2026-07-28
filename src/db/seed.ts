import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { Db } from "./index";
import { appSettings, slashCommands } from "./schema";

const EXPAND_TEMPLATE = `You are a fiction writing assistant for Quillsmith.
Continue the current scene based on the user's instruction.
Stay consistent with POV, tense, voice, act brief, chapter goal, and beats.
Do not summarize. Write prose only unless tools are required.

Novel premise: {{novelPremise}}
Act: {{actTitle}}
Act brief: {{actBrief}}
Chapter goal: {{chapterGoal}}
Chapter beats:
{{chapterBeats}}

Previous scene:
{{previousScene}}

Current scene:
{{currentScene}}

Next scene:
{{nextScene}}

Relevant knowledge:
{{knowledge}}

User instruction:
{{userInstruction}}

Continue from the end of the current scene.`;

const REWRITE_TEMPLATE = `You are a fiction writing assistant for Quillsmith.
Rewrite the current scene according to the user's instruction.
Preserve continuity with act brief, chapter goal, beats, and knowledge.
Return the full rewritten scene prose only (no commentary) after any tool use.

Novel premise: {{novelPremise}}
Act: {{actTitle}}
Act brief: {{actBrief}}
Chapter goal: {{chapterGoal}}
Chapter beats:
{{chapterBeats}}

Previous scene:
{{previousScene}}

Current scene:
{{currentScene}}

Next scene:
{{nextScene}}

Relevant knowledge:
{{knowledge}}

User instruction:
{{userInstruction}}

Rewrite the current scene.`;

export function seedIfNeeded(db: Db) {
  const settings = db.select().from(appSettings).where(eq(appSettings.id, 1)).all();
  if (settings.length === 0) {
    db.insert(appSettings)
      .values({
        id: 1,
        openrouterApiKey: process.env.OPENROUTER_API_KEY ?? "",
        defaultModel: "anthropic/claude-sonnet-4",
        theme: "system",
      })
      .run();
  }

  const commands = db.select().from(slashCommands).all();
  if (commands.length === 0) {
    db.insert(slashCommands)
      .values([
        {
          id: nanoid(),
          slug: "expand",
          label: "Expand",
          description: "Continue writing from the end of the scene",
          defaultTemperature: 0.8,
          promptTemplate: EXPAND_TEMPLATE,
          enableTools: "true",
          builtIn: true,
        },
        {
          id: nanoid(),
          slug: "rewrite",
          label: "Rewrite",
          description: "Rewrite the current scene with instructions",
          defaultTemperature: 0.7,
          promptTemplate: REWRITE_TEMPLATE,
          enableTools: "true",
          builtIn: true,
        },
      ])
      .run();
  }
}
