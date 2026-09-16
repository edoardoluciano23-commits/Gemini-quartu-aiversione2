import { systemLogs, clearLogs } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ logs: systemLogs });
}

export async function DELETE() {
  clearLogs();
  return Response.json({ success: true });
}
