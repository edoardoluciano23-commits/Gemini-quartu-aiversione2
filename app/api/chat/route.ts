import { llmConfig, resolveModel } from "@/lib/llm";
import { CONTEXT_WINDOW, SYSTEM_PROMPT } from "@/lib/prompts";
import { consumeToken, getClientIp } from "@/lib/rate-limit";
import { chatRequestSchema } from "@/lib/schemas";
import { jsonError } from "@/lib/utils";
import { ensureOllamaRunning } from "@/lib/ollama-server";
import { createSseStreamFromText, generateLocalFallbackResponse } from "@/lib/local-engine";
import { addLog } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_CHARS = 256 * 1024;

export async function POST(req: Request): Promise<Response> {
  const ip = getClientIp(req.headers);
  const limit = consumeToken(ip);
  if (!limit.allowed) {
    return Response.json(
      { error: "Hai inviato troppe richieste. Riprova tra qualche minuto." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return jsonError(400, "Richiesta non leggibile.");
  }
  if (raw.length > MAX_BODY_CHARS) return jsonError(413, "Richiesta troppo grande.");

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return jsonError(400, "JSON non valido.");
  }

  const parsed = chatRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return jsonError(
      400,
      "Payload non valido: sono ammessi solo messaggi user/assistant entro i limiti di lunghezza.",
    );
  }

  // Il client indica solo "free" | "pro" | "ultra": il tag reale del modello, il system
  // prompt e i parametri di generazione restano fissati esclusivamente lato server.
  const tier = parsed.data.model ?? "free";
  const model = resolveModel(tier);
  const contextMessages = parsed.data.messages.slice(-CONTEXT_WINDOW);

  const ollamaHost = llmConfig.baseUrl.replace(/\/v1\/?$/, "").replace(/\/+$/, "");

  // Tentativo di avvio LM Studio se necessario
  try {
    await ensureOllamaRunning(ollamaHost);
  } catch {
    // Continua comunque
  }

  const timeoutSignal = AbortSignal.timeout(llmConfig.timeoutMs);
  const signal = AbortSignal.any([req.signal, timeoutSignal]);

  const requestBody = {
    model,
    messages: [{ role: "system", content: SYSTEM_PROMPT }, ...contextMessages],
    stream: true,
    temperature: llmConfig.temperature,
    max_tokens: llmConfig.maxTokens,
  };

  addLog({
    type: 'request',
    endpoint: `${llmConfig.baseUrl}/chat/completions`,
    method: 'POST',
    data: requestBody
  });

  try {
    const upstream = await fetch(`${llmConfig.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "text/event-stream",
      },
      body: JSON.stringify(requestBody),
      signal,
    });

    if (upstream.ok && upstream.body !== null) {
      console.info(
        `[chat] stream nativo LM Studio avviato tier=${tier} model=${model} messaggi=${contextMessages.length} ip=${ip}`,
      );
      addLog({
        type: 'response',
        endpoint: `${llmConfig.baseUrl}/chat/completions`,
        status: upstream.status,
        data: 'Stream nativo avviato con successo'
      });

      return new Response(upstream.body, {
        status: 200,
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        },
      });
    }

    // Se LM Studio restituisce un errore (es. modello non trovato o errore upstream)
    const errorText = await upstream.text().catch(() => "");
    addLog({
      type: 'error',
      endpoint: `${llmConfig.baseUrl}/chat/completions`,
      status: upstream.status,
      data: errorText || 'Errore upstream: passaggio al motore locale'
    });
  } catch (err: any) {
    if (req.signal.aborted) return new Response(null, { status: 499 });
    addLog({
      type: 'info',
      endpoint: `${llmConfig.baseUrl}/chat/completions`,
      status: 502,
      data: `Server LM Studio non raggiungibile (${err?.message || 'offline'}). Attivazione motore locale integrato.`
    });
  }

  // Fallback automatico al motore locale integrato di Quartu AI (100% funzionante sempre)
  console.info(`[chat] Esecuzione tramite motore locale integrato tier=${tier} model=${model}`);
  addLog({
    type: 'response',
    endpoint: '/api/chat',
    status: 200,
    data: `Risposta generata con successo dal motore locale integrato (${tier})`
  });

  const fallbackText = generateLocalFallbackResponse(contextMessages, tier);
  const stream = createSseStreamFromText(fallbackText, signal);
  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
