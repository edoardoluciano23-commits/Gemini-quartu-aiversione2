import { llmConfig } from "@/lib/llm";
import { ensureOllamaRunning } from "@/lib/ollama-server";
import { addLog } from "@/lib/logger";
import { getLocalModelRegistry, getInstalledModelList } from "@/lib/model-registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const customHost = url.searchParams.get("host");
  const ollamaHost = (customHost || llmConfig.baseUrl.replace(/\/v1\/?$/, "")).replace(/\/+$/, "");

  let isRunning = false;
  try {
    isRunning = await ensureOllamaRunning(ollamaHost);
  } catch {
    isRunning = false;
  }

  if (!isRunning || ollamaHost.includes("<tuo-subdomain>")) {
    const localStatus = getLocalModelRegistry();
    const installedList = getInstalledModelList();
    return Response.json({
      connected: true,
      engine: "local-integrated",
      host: "Motore Locale Quartu AI (Integrato)",
      version: "v1.0.0 (offline-first)",
      installed: installedList,
      required: {
        free: llmConfig.models.free,
        pro: llmConfig.models.pro,
        ultra: llmConfig.models.ultra,
      },
      status: localStatus,
    });
  }

  try {
    addLog({
      type: 'request',
      endpoint: `${ollamaHost}/v1/models`,
      method: 'GET'
    });
    
    // LM Studio usually doesn't have a version endpoint, we just skip it
    const versionData = { version: "LM Studio" };

    const res = await fetch(`${ollamaHost}/v1/models`, {
      signal: AbortSignal.timeout(3000),
    });

    if (!res.ok) {
      addLog({
        type: 'error',
        endpoint: `${ollamaHost}/v1/models`,
        status: res.status,
        data: 'Errore recupero modelli LM Studio'
      });
      throw new Error("Errore recupero modelli LM Studio");
    }

    const data = await res.json();
    addLog({
      type: 'response',
      endpoint: `${ollamaHost}/v1/models`,
      status: res.status,
      data: data
    });
    
    // Convert OpenAI format to our internal format
    const rawModels: Array<{ id: string }> = data.data || [];

    const installed = rawModels.map((m) => ({
      name: m.id,
      model: m.id,
      size: 0,
      sizeFormatted: "N/A",
      digest: m.id,
      modifiedAt: "",
    }));

    const isMatch = (requiredTag: string) => {
      const reqClean = requiredTag.toLowerCase().trim();
      const reqNameOnly = reqClean.split(":")[0];
      return installed.some((m) => {
        const mClean = m.name.toLowerCase();
        const mModel = (m.model || "").toLowerCase();
        return (
          mClean === reqClean ||
          mModel === reqClean ||
          mClean === `${reqClean}:latest` ||
          mClean.endsWith(reqClean) ||
          (reqNameOnly && mClean.startsWith(reqNameOnly))
        );
      });
    };

    return Response.json({
      connected: true,
      host: ollamaHost,
      version: versionData?.version || "online",
      installed,
      required: {
        free: llmConfig.models.free,
        pro: llmConfig.models.pro,
        ultra: llmConfig.models.ultra,
      },
      status: {
        free: isMatch(llmConfig.models.free),
        pro: isMatch(llmConfig.models.pro),
        ultra: isMatch(llmConfig.models.ultra),
      },
    });
  } catch (err: any) {
    addLog({
      type: 'error',
      endpoint: `${ollamaHost}/v1/models`,
      data: err?.message || 'Unknown network error'
    });
    const localStatus = getLocalModelRegistry();
    const installedList = getInstalledModelList();
    return Response.json({
      connected: true,
      engine: "local-integrated",
      host: "Motore Locale Quartu AI (Integrato)",
      version: "v1.0.0 (offline-first)",
      installed: installedList,
      required: {
        free: llmConfig.models.free,
        pro: llmConfig.models.pro,
        ultra: llmConfig.models.ultra,
      },
      status: localStatus,
    });
  }
}

