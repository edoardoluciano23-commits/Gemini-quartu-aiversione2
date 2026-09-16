import { llmConfig, resolveModel } from "@/lib/llm";
import { ensureOllamaRunning } from "@/lib/ollama-server";
import { jsonError, readJsonBody } from "@/lib/utils";
import { modelTierSchema } from "@/lib/schemas";
import { setModelInstalled } from "@/lib/model-registry";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const pullSchema = z.object({
  tier: modelTierSchema,
  host: z.string().optional(),
});

export async function POST(req: Request) {
  const body = await readJsonBody(req, 1024);
  if (!body.ok) return jsonError(body.status, body.message);

  const parsed = pullSchema.safeParse(body.value);
  if (!parsed.success) return jsonError(400, "Tier non valido.");

  const tier = parsed.data.tier;
  const modelTag = resolveModel(tier);
  const lmstudioHost = (parsed.data.host || llmConfig.baseUrl.replace(/\/v1\/?$/, "")).replace(/\/+$/, "");

  let running = false;
  try {
    running = await ensureOllamaRunning(lmstudioHost);
  } catch {
    running = false;
  }

  if (!running || lmstudioHost.includes("<tuo-subdomain>")) {
    return jsonError(503, "Ollama / LM Studio non è in esecuzione o non è raggiungibile.");
  }

  try {
    const res = await fetch(`${lmstudioHost}/api/pull`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: modelTag, stream: true }),
      signal: req.signal,
    });

    if (!res.ok || !res.body) {
      return jsonError(res.status, "Impossibile scaricare il modello tramite il demone locale.");
    }

    setModelInstalled(tier, true);

    return new Response(res.body, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch {
    return jsonError(500, "Errore interno durante il download del modello.");
  }
}

