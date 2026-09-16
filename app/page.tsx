import { desc } from "drizzle-orm";
import { ChatShell } from "@/components/chat/chat-shell";
import { db, serializeConversation } from "@/lib/db";
import { conversations } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const rows = await db.select().from(conversations).orderBy(desc(conversations.updatedAt));
  return <ChatShell initialConversations={rows.map(serializeConversation)} />;
}
