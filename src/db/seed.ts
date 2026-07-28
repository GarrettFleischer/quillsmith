import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { Db } from "./index";
import { appSettings, slashCommands } from "./schema";
import { BUILTIN_COMMANDS } from "@/lib/prompts/templates";

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

  for (const cmd of BUILTIN_COMMANDS) {
    const existing = db
      .select()
      .from(slashCommands)
      .where(eq(slashCommands.slug, cmd.slug))
      .get();

    if (!existing) {
      db.insert(slashCommands)
        .values({
          id: nanoid(),
          slug: cmd.slug,
          label: cmd.label,
          description: cmd.description,
          defaultTemperature: cmd.defaultTemperature,
          promptTemplate: cmd.promptTemplate,
          enableTools: cmd.enableTools,
          builtIn: true,
        })
        .run();
      continue;
    }

    // Built-in prompts are owned by the app so craft-rule updates ship on restart.
    if (existing.builtIn) {
      db.update(slashCommands)
        .set({
          label: cmd.label,
          description: cmd.description,
          defaultTemperature: cmd.defaultTemperature,
          promptTemplate: cmd.promptTemplate,
          enableTools: cmd.enableTools,
          builtIn: true,
        })
        .where(eq(slashCommands.id, existing.id))
        .run();
    }
  }
}
