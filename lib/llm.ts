// Solo server: non importare questo modulo da componenti client, altrimenti
// gli URL interni e i tag dei modelli finirebbero nel bundle.
import type { ModelTier } from "@/lib/models";

function readPositiveInteger(value: string | undefined, fallback: number): number {
  if (value === undefined || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`Valore numerico non valido per la configurazione LLM: ${value}`);
  }
  return parsed;
}

const rawBaseUrl = (process.env.LLM_BASE_URL ?? "").trim();
const isPlaceholder = rawBaseUrl.includes("<") || rawBaseUrl.includes("tuo-subdomain");
const effectiveBaseUrl = (!isPlaceholder && rawBaseUrl.length > 0)
  ? rawBaseUrl.replace(/\/+$/, "")
  : "http://127.0.0.1:1234/v1";

export const llmConfig = {
  baseUrl: effectiveBaseUrl,
  models: {
    free: process.env.LLM_MODEL_FREE || "granite4:350m-h",
    pro: process.env.LLM_MODEL_PRO || "MichelRosselli/ternary-bonsai:1.7b-f16",
    ultra: process.env.LLM_MODEL_ULTRA || "qwen2.5:3b",
  },
  timeoutMs: readPositiveInteger(process.env.LLM_TIMEOUT_MS, 120_000),
  temperature: 0.6,
  maxTokens: 2048,
} as const;

export function resolveModel(tier: ModelTier): string {
  return llmConfig.models[tier];
}
