import { llmConfig, resolveModel } from "@/lib/llm";
import { jsonError, readJsonBody } from "@/lib/utils";
import { modelTierSchema } from "@/lib/schemas";
import { setModelInstalled } from "@/lib/model-registry";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const deleteSchema = z.object({
  tier: modelTierSchema,
  host: z.string().optional(),
});

export async function POST(req: Request) {
  const body = await readJsonBody(req, 1024);
  if (!body.ok) return jsonError(body.status, body.message);

  const parsed = deleteSchema.safeParse(body.value);
  if (!parsed.success) return jsonError(400, "Tier non valido.");

  const tier = parsed.data.tier;
  const modelTag = resolveModel(tier);
  const lmstudioHost = (parsed.data.host || llmConfig.baseUrl.replace(/\/v1\/?$/, "")).replace(/\/+$/, "");

  // Rimuovi dal registro locale
  setModelInstalled(tier, false);

  try {
    const res = await fetch(`${lmstudioHost}/api/delete`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: modelTag }),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      // Se non era su LM Studio, consideralo comunque rimosso localmente
      return Response.json({ success: true, deleted: modelTag, localOnly: true });
    }

    return Response.json({ success: true, deleted: modelTag });
  } catch {
    // Se LM Studio non è raggiungibile, è stato comunque eliminato dal registro locale
    return Response.json({ success: true, deleted: modelTag, localOnly: true });
  }
}

