import {
  createNovel,
  deleteNovel,
  listNovels,
} from "@/lib/novels";

export const runtime = "nodejs";

export async function GET() {
  return Response.json(listNovels());
}

export async function POST(req: Request) {
  const body = (await req.json()) as { title?: string };
  const novel = createNovel(body.title?.trim() || "Untitled novel");
  return Response.json(novel);
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return Response.json({ error: "id required" }, { status: 400 });
  deleteNovel(id);
  return Response.json({ ok: true });
}
