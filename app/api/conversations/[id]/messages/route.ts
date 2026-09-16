import { asc, desc, eq } from "drizzle-orm";
import { db, serializeMessage } from "@/lib/db";
import { conversations, messages } from "@/lib/db/schema";
import { appendMessagesSchema, conversationIdSchema } from "@/lib/schemas";
import { jsonError, readJsonBody } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

async function resolveId(context: RouteContext): Promise<string | null> {
  const { id } = await context.params;
  return conversationIdSchema.safeParse(id).success ? id : null;
}

async function conversationExists(id: string): Promise<boolean> {
  const rows = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(eq(conversations.id, id))
    .limit(1);
  return rows.length === 1;
}

export async function GET(req: Request, context: RouteContext): Promise<Response> {
  const id = await resolveId(context);
  if (id === null) return jsonError(400, "Identificativo non valido.");
  if (!(await conversationExists(id))) return jsonError(404, "Conversazione non trovata.");

  // L'id come criterio secondario evita ambiguità con createdAt identici.
  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(asc(messages.createdAt), asc(messages.id));
  return Response.json({ messages: rows.map(serializeMessage) });
}

export async function POST(req: Request, context: RouteContext): Promise<Response> {
  const id = await resolveId(context);
  if (id === null) return jsonError(400, "Identificativo non valido.");

  const body = await readJsonBody(req, 64 * 1024);
  if (!body.ok) return jsonError(body.status, body.message);

  const parsed = appendMessagesSchema.safeParse(body.value);
  if (!parsed.success) return jsonError(400, "Dati non validi.");
  if (!(await conversationExists(id))) return jsonError(404, "Conversazione non trovata.");

  const { messages: toInsert, replaceLastAssistant } = parsed.data;

  const saved = db.transaction((tx) => {
    if (replaceLastAssistant === true) {
      // Operazione consentita solo sull'ultimo messaggio e solo se è
      // dell'assistente (caso "rigenera risposta"): il client non può
      // riscrivere arbitrariamente lo storico salvato.
      const last = tx
        .select()
        .from(messages)
        .where(eq(messages.conversationId, id))
        .orderBy(desc(messages.createdAt), desc(messages.id))
        .limit(1)
        .all();
      const candidate = last[0];
      if (candidate !== undefined && candidate.role === "assistant") {
        tx.delete(messages).where(eq(messages.id, candidate.id)).run();
      }
    }

    const base = Date.now();
    const rows = toInsert.map((message, index) => ({
      id: crypto.randomUUID(),
      conversationId: id,
      role: message.role,
      content: message.content,
      status: message.status ?? ("complete" as const),
      createdAt: new Date(base + index),
    }));
    for (const row of rows) tx.insert(messages).values(row).run();
    tx.update(conversations)
      .set({ updatedAt: new Date(base + rows.length) })
      .where(eq(conversations.id, id))
      .run();
    return rows;
  });

  return Response.json({ messages: saved.map(serializeMessage) }, { status: 201 });
}
