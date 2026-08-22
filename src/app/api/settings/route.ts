import { getSettings, listCommands, listTaskOverrides, setCommandFavorite, updateSettings, upsertTaskOverride } from "@/lib/novels";
import { AI_TASKS } from "@/lib/ai-tasks";
import { getDb } from "@/db";
import { commandModelOverrides, slashCommands } from "@/db/schema";
import { eq } from "drizzle-orm";
import { id } from "@/lib/utils";

export const runtime = "nodejs";

export async function GET() {
  return Response.json({
    settings: getSettings(),
    commands: listCommands(),
    overrides: getDb().select().from(commandModelOverrides).all(),
    taskOverrides: listTaskOverrides(),
    tasks: AI_TASKS.map((t) => ({
      id: t.id,
      label: t.label,
      description: t.description,
      defaultModel: t.defaultModel,
      temperature: t.temperature,
      group: t.group,
    })),
  });
}

export async function PATCH(req: Request) {
  const body = (await req.json()) as {
    action: string;
    payload: Record<string, unknown>;
  };
  const db = getDb();

  if (body.action === "updateSettings") {
    return Response.json(updateSettings(body.payload as never));
  }

  if (body.action === "upsertCommand") {
    const p = body.payload as {
      id?: string;
      slug: string;
      label: string;
      description?: string;
      defaultTemperature?: number;
      promptTemplate: string;
      enableTools?: string;
    };
    if (p.id) {
      const existing = db.select().from(slashCommands).where(eq(slashCommands.id, p.id)).get();
      const forkingBuiltin = Boolean(existing?.builtIn);
      const nextSlug =
        forkingBuiltin && (p.slug === "expand" || p.slug === "rewrite")
          ? `${p.slug}-custom`
          : p.slug;
      db.update(slashCommands)
        .set({
          slug: nextSlug,
          label: p.label,
          description: p.description,
          defaultTemperature: p.defaultTemperature,
          promptTemplate: p.promptTemplate,
          enableTools: p.enableTools ?? "true",
          // Editing a built-in forks it so app prompt sync won't overwrite custom work.
          builtIn: false,
        })
        .where(eq(slashCommands.id, p.id))
        .run();
      return Response.json(db.select().from(slashCommands).where(eq(slashCommands.id, p.id)).get());
    }
    const cmdId = id();
    db.insert(slashCommands)
      .values({
        id: cmdId,
        slug: p.slug,
        label: p.label,
        description: p.description ?? "",
        defaultTemperature: p.defaultTemperature ?? 0.7,
        promptTemplate: p.promptTemplate,
        enableTools: p.enableTools ?? "true",
        builtIn: false,
      })
      .run();
    return Response.json(db.select().from(slashCommands).where(eq(slashCommands.id, cmdId)).get());
  }

  if (body.action === "setCommandFavorite") {
    const p = body.payload as { id: string; favorite: boolean };
    return Response.json(setCommandFavorite(p.id, Boolean(p.favorite)));
  }

  if (body.action === "deleteCommand") {
    const cmd = db
      .select()
      .from(slashCommands)
      .where(eq(slashCommands.id, String(body.payload.id)))
      .get();
    if (!cmd) return Response.json({ error: "Command not found" }, { status: 404 });
    if (cmd.builtIn) {
      return Response.json({ error: "Built-in commands cannot be deleted" }, { status: 400 });
    }
    db.delete(slashCommands).where(eq(slashCommands.id, cmd.id)).run();
    return Response.json({ ok: true });
  }

  if (body.action === "upsertOverride") {
    const p = body.payload as {
      id?: string;
      commandId: string;
      modelId: string;
      temperature?: number;
      promptTemplate?: string;
    };
    if (p.id) {
      db.update(commandModelOverrides)
        .set({
          modelId: p.modelId,
          temperature: p.temperature,
          promptTemplate: p.promptTemplate,
        })
        .where(eq(commandModelOverrides.id, p.id))
        .run();
    } else {
      db.insert(commandModelOverrides)
        .values({
          id: id(),
          commandId: p.commandId,
          modelId: p.modelId,
          temperature: p.temperature,
          promptTemplate: p.promptTemplate,
        })
        .run();
    }
    return Response.json(db.select().from(commandModelOverrides).all());
  }

  if (body.action === "upsertTaskOverride") {
    const p = body.payload as {
      taskId: string;
      modelId: string;
      temperature?: number | null;
    };
    return Response.json(upsertTaskOverride(p));
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
