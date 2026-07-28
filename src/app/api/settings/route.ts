import { getSettings, listCommands, updateSettings } from "@/lib/novels";
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
      db.update(slashCommands)
        .set({
          slug: p.slug,
          label: p.label,
          description: p.description,
          defaultTemperature: p.defaultTemperature,
          promptTemplate: p.promptTemplate,
          enableTools: p.enableTools ?? "true",
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

  if (body.action === "deleteCommand") {
    db.delete(slashCommands).where(eq(slashCommands.id, String(body.payload.id))).run();
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

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
