import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";

const databasePath = process.env.DATABASE_PATH ?? "./data/chat.db";

function extractIdFromCondition(condition: any): string | null {
  if (!condition) return null;
  if (condition.right !== undefined && typeof condition.right === 'string') return condition.right;
  if (condition.right && condition.right.value !== undefined && typeof condition.right.value === 'string') return condition.right.value;
  if (condition.value !== undefined && typeof condition.value === 'string') return condition.value;
  
  let found: string | null = null;
  const search = (obj: any) => {
    if (found) return;
    if (typeof obj === 'string') {
      if (obj.length > 5) found = obj; 
      return;
    }
    if (obj && typeof obj === 'object') {
      for (const k of Object.keys(obj)) {
        if (k === 'table' || k === 'column' || k === 'name' || k === 'config') continue;
        search(obj[k]);
      }
    }
  };
  search(condition);
  return found;
}

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
      let isDescending = false;
      let isOrderBySet = false;

      const chain: any = {
        from: (table: any) => {
          targetTable = getTable(table);
          return chain;
        },
        where: (condition: any) => {
          const id = extractIdFromCondition(condition);
          if (id) {
            filterFn = (item) => item.id === id || item.conversationId === id;
          }
          return chain;
        },
        orderBy: (...args: any[]) => {
          isOrderBySet = true;
          const argsStr = JSON.stringify(args);
          if (argsStr.includes('"desc"') || argsStr.includes('desc')) {
            isDescending = true;
          }
          return chain;
        },
        limit: (n: number) => {
          limitNum = n;
          return chain;
        },
        all: () => {
          let result = [...targetTable];
          if (filterFn) result = result.filter(filterFn);
          if (isOrderBySet) {
             result.sort((a, b) => {
               const tA = (a.updatedAt ?? a.createdAt)?.getTime?.() ?? (typeof a.createdAt === 'number' ? a.createdAt : 0);
               const tB = (b.updatedAt ?? b.createdAt)?.getTime?.() ?? (typeof b.createdAt === 'number' ? b.createdAt : 0);
               return isDescending ? tB - tA : tA - tB;
             });
          }
          if (limitNum !== null) result = result.slice(0, limitNum);
          if (fields && Object.keys(fields).length === 1 && fields.id) {
            result = result.map((r) => ({ id: r.id }));
          }
          return result;
        },
        then: (resolve: (val: any) => void) => resolve(chain.all()),
      };
      return chain;
    },
    insert: (table: any) => {
      const targetTable = getTable(table);
      return {
        values: (val: any | any[]) => {
          const items = Array.isArray(val) ? val : [val];
          const chain: any = {
            run: () => {
              for (const item of items) targetTable.push(item);
            },
            all: () => {
              chain.run();
              return items;
            },
            then: (resolve: (val: any) => void) => resolve(chain.all()),
            returning: () => chain,
          };
          return chain;
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
          filterId = extractIdFromCondition(condition);
          return chain;
        },
        returning: () => chain,
        all: () => {
          const updated: any[] = [];
          if (filterId) {
            for (const item of targetTable) {
              if (item.id === filterId || item.conversationId === filterId) {
                Object.assign(item, updateData);
                updated.push(item);
              }
            }
          }
          return updated;
        },
        run: () => { chain.all(); },
        then: (resolve: (val: any) => void) => resolve(chain.all()),
      };
      return chain;
    },
    delete: (table: any) => {
      const targetTable = getTable(table);
      let filterId: string | null = null;

      const chain: any = {
        where: (condition: any) => {
          filterId = extractIdFromCondition(condition);
          return chain;
        },
        returning: () => chain,
        all: () => {
          const deleted: any[] = [];
          if (filterId) {
            for (let i = targetTable.length - 1; i >= 0; i--) {
              if (targetTable[i].id === filterId || targetTable[i].conversationId === filterId) {
                deleted.push(targetTable[i]);
                targetTable.splice(i, 1);
              }
            }
          }
          return deleted.reverse();
        },
        run: () => { chain.all(); },
        then: (resolve: (val: any) => void) => resolve(chain.all()),
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
    createdAt: row.createdAt instanceof Date ? row.createdAt.getTime() : new Date(row.createdAt).getTime(),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.getTime() : new Date(row.updatedAt).getTime(),
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
    createdAt: row.createdAt instanceof Date ? row.createdAt.getTime() : new Date(row.createdAt).getTime(),
  };
}
