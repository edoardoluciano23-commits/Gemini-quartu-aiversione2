import { desc } from "drizzle-orm";
import { db, serializeConversation } from "@/lib/db";
import { conversations } from "@/lib/db/schema";
import { createConversationSchema } from "@/lib/schemas";
import { jsonError, readJsonBody } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const rows = await db.select().from(conversations).orderBy(desc(conversations.updatedAt));
  return Response.json({ conversations: rows.map(serializeConversation) });
}

export async function POST(req: Request): Promise<Response> {
  const body = await readJsonBody(req, 4096);
  if (!body.ok) return jsonError(body.status, body.message);

  const parsed = createConversationSchema.safeParse(body.value);
  if (!parsed.success) return jsonError(400, "Dati non validi.");

  const now = new Date();
  const row = {
    id: crypto.randomUUID(),
    userId: null,
    title: parsed.data.title ?? "Nuova conversazione",
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(conversations).values(row);
  return Response.json({ conversation: serializeConversation(row) }, { status: 201 });
}
