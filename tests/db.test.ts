import Database from "better-sqlite3";
import { asc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { describe, expect, it } from "vitest";
import * as schema from "@/lib/db/schema";

function createTestDb() {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: "drizzle" });
  return db;
}

describe("smoke test persistenza", () => {
  it("crea una conversazione, salva i messaggi e li ricarica", () => {
    const db = createTestDb();
    const now = new Date();
    const conversationId = crypto.randomUUID();

    db.insert(schema.conversations)
      .values({ id: conversationId, userId: null, title: "Test", createdAt: now, updatedAt: now })
      .run();

    db.insert(schema.messages)
      .values([
        {
          id: crypto.randomUUID(),
          conversationId,
          role: "user",
          content: "Domanda",
          status: "complete",
          createdAt: new Date(now.getTime()),
        },
        {
          id: crypto.randomUUID(),
          conversationId,
          role: "assistant",
          content: "Risposta",
          status: "complete",
          createdAt: new Date(now.getTime() + 1),
        },
      ])
      .run();

    const loaded = db
      .select()
      .from(schema.messages)
      .where(eq(schema.messages.conversationId, conversationId))
      .orderBy(asc(schema.messages.createdAt), asc(schema.messages.id))
      .all();

    expect(loaded).toHaveLength(2);
    expect(loaded[0]?.role).toBe("user");
    expect(loaded[1]?.content).toBe("Risposta");

    // La cancellazione transazionale rimuove conversazione e messaggi.
    db.transaction((tx) => {
      tx.delete(schema.messages).where(eq(schema.messages.conversationId, conversationId)).run();
      tx.delete(schema.conversations).where(eq(schema.conversations.id, conversationId)).run();
    });

    expect(db.select().from(schema.messages).all()).toHaveLength(0);
    expect(db.select().from(schema.conversations).all()).toHaveLength(0);
  });
});
