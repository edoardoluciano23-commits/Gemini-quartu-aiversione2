import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";

const databasePath = process.env.DATABASE_PATH ?? "./data/chat.db";

function createDb(): BetterSQLite3Database<typeof schema> {
  if (databasePath !== ":memory:") {
    fs.mkdirSync(path.dirname(path.resolve(databasePath)), { recursive: true });
  }
  const sqlite = new Database(databasePath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  const instance = drizzle(sqlite, { schema });
  // Migrazioni idempotenti all'avvio: semplificano sviluppo e deploy Docker.
  migrate(instance, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  return instance;
}

// Singleton su globalThis per non riaprire connessioni a ogni HMR in sviluppo.
const globalForDb = globalThis as unknown as {
  quartuDb?: BetterSQLite3Database<typeof schema>;
};

export const db = globalForDb.quartuDb ?? createDb();
if (process.env.NODE_ENV !== "production") globalForDb.quartuDb = db;

export function serializeConversation(row: typeof schema.conversations.$inferSelect): {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
} {
  return {
    id: row.id,
    title: row.title,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
  };
}

export function serializeMessage(row: typeof schema.messages.$inferSelect): {
  id: string;
  role: "user" | "assistant";
  content: string;
  status: "complete" | "incomplete";
  createdAt: number;
} {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    status: row.status,
    createdAt: row.createdAt.getTime(),
  };
}
