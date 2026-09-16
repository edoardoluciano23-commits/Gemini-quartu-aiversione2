import { eq } from "drizzle-orm";
import { db, serializeConversation } from "@/lib/db";
import { conversations, messages } from "@/lib/db/schema";
import { conversationIdSchema, renameConversationSchema } from "@/lib/schemas";
import { jsonError, readJsonBody } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

async function resolveId(context: RouteContext): Promise<string | null> {
  const { id } = await context.params;
  return conversationIdSchema.safeParse(id).success ? id : null;
}

export async function PATCH(req: Request, context: RouteContext): Promise<Response> {
  const id = await resolveId(context);
  if (id === null) return jsonError(400, "Identificativo non valido.");

  const body = await readJsonBody(req, 4096);
  if (!body.ok) return jsonError(body.status, body.message);

  const parsed = renameConversationSchema.safeParse(body.value);
  if (!parsed.success) return jsonError(400, "Titolo non valido.");

  const updated = await db
    .update(conversations)
    .set({ title: parsed.data.title, updatedAt: new Date() })
    .where(eq(conversations.id, id))
    .returning();

  const row = updated[0];
  if (row === undefined) return jsonError(404, "Conversazione non trovata.");
  return Response.json({ conversation: serializeConversation(row) });
}

export async function DELETE(req: Request, context: RouteContext): Promise<Response> {
  const id = await resolveId(context);
  if (id === null) return jsonError(400, "Identificativo non valido.");

  // Cancellazione atomica di conversazione e relativi messaggi.
  const deleted = db.transaction((tx) => {
    tx.delete(messages).where(eq(messages.conversationId, id)).run();
    return tx
      .delete(conversations)
      .where(eq(conversations.id, id))
      .returning({ id: conversations.id })
      .all();
  });

  if (deleted.length === 0) return jsonError(404, "Conversazione non trovata.");
  return Response.json({ deleted: true });
}
