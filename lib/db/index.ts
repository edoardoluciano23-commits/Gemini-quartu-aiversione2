import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";

const databasePath = process.env.DATABASE_PATH ?? "./data/chat.db";

function createFallbackDb(): any {
  const store = {
    conversations: [] as any[],
    messages: [] as any[],
  };

  const getTable = (target: any) => {
    if (target === schema.conversations) return store.conversations;
    if (target === schema.messages) return store.messages;
    return store.conversations;
  };

  const dbObj: any = {
    select: (fields?: any) => {
      let targetTable: any[] = store.conversations;
      let filterFn: ((item: any) => boolean) | null = null;
      let limitNum: number | null = null;
      let isDescending = true;

      const chain: any = {
        from: (table: any) => {
          targetTable = getTable(table);
          return chain;
        },
        where: (condition: any) => {
          if (condition && condition.val !== undefined && condition.id !== undefined) {
            filterFn = (item) => item.id === condition.val || item.conversationId === condition.val;
          }
          return chain;
        },
        orderBy: (...args: any[]) => {
          return chain;
        },
        limit: (n: number) => {
          limitNum = n;
          return chain;
        },
        all: () => chain.then((res: any) => res),
        then: (resolve: (val: any) => void) => {
          let result = [...targetTable];
          if (filterFn) result = result.filter(filterFn);
          result.sort((a, b) => {
            const tA = (a.updatedAt ?? a.createdAt)?.getTime?.() ?? a.createdAt ?? 0;
            const tB = (b.updatedAt ?? b.createdAt)?.getTime?.() ?? b.createdAt ?? 0;
            return isDescending ? tB - tA : tA - tB;
          });
          if (limitNum !== null) result = result.slice(0, limitNum);
          if (fields && Object.keys(fields).length === 1 && fields.id) {
            result = result.map((r) => ({ id: r.id }));
          }
          resolve(result);
        },
      };
      return chain;
    },
    insert: (table: any) => {
      const targetTable = getTable(table);
      return {
        values: (val: any | any[]) => {
          const items = Array.isArray(val) ? val : [val];
          for (const item of items) {
            targetTable.push(item);
          }
          return {
            run: () => {},
            then: (resolve: (val: any) => void) => resolve(items),
          };
        },
      };
    },
    update: (table: any) => {
      const targetTable = getTable(table);
      let updateData: any = {};
      let filterId: string | null = null;

      const chain: any = {
        set: (data: any) => {
          updateData = data;
          return chain;
        },
        where: (condition: any) => {
          if (condition && condition.val !== undefined) {
            filterId = condition.val;
          }
          return chain;
        },
        returning: () => chain,
        run: () => {
          if (filterId) {
            const item = targetTable.find((i) => i.id === filterId);
            if (item) Object.assign(item, updateData);
          }
        },
        then: (resolve: (val: any) => void) => {
          const updated: any[] = [];
          if (filterId) {
            const item = targetTable.find((i) => i.id === filterId);
            if (item) {
              Object.assign(item, updateData);
              updated.push(item);
            }
          }
          resolve(updated);
        },
      };
      return chain;
    },
    delete: (table: any) => {
      const targetTable = getTable(table);
      let filterId: string | null = null;

      const chain: any = {
        where: (condition: any) => {
          if (condition && condition.val !== undefined) {
            filterId = condition.val;
          }
          return chain;
        },
        returning: () => chain,
        all: () => {
          const deleted: any[] = [];
          if (filterId) {
            const idx = targetTable.findIndex((i) => i.id === filterId || i.conversationId === filterId);
            if (idx !== -1) {
              deleted.push(targetTable[idx]);
              targetTable.splice(idx, 1);
            }
          }
          return deleted;
        },
        run: () => {
          if (filterId) {
            for (let i = targetTable.length - 1; i >= 0; i--) {
              if (targetTable[i].id === filterId || targetTable[i].conversationId === filterId) {
                targetTable.splice(i, 1);
              }
            }
          }
        },
        then: (resolve: (val: any) => void) => {
          const deleted = chain.all();
          resolve(deleted);
        },
      };
      return chain;
    },
    transaction: (cb: (tx: any) => any) => {
      return cb(dbObj);
    },
  };

  return dbObj;
}

function createDb(): BetterSQLite3Database<typeof schema> {
  try {
    if (databasePath !== ":memory:") {
      fs.mkdirSync(path.dirname(path.resolve(databasePath)), { recursive: true });
    }
    const sqlite = new Database(databasePath);
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");
    sqlite.pragma("busy_timeout = 5000");
    const instance = drizzle(sqlite, { schema });
    migrate(instance, { migrationsFolder: path.join(process.cwd(), "drizzle") });
    return instance;
  } catch (err) {
    console.warn("Native better-sqlite3 not available in this environment. Falling back to in-memory store.");
    return createFallbackDb();
  }
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
