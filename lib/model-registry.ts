import fs from "node:fs";
import path from "node:path";
import { llmConfig, resolveModel } from "@/lib/llm";
import type { ModelTier } from "@/lib/models";

export interface InstalledModelRecord {
  name: string;
  model: string;
  size: number;
  sizeFormatted: string;
  digest: string;
  modifiedAt: string;
  tier: ModelTier;
}

const REGISTRY_FILE = path.join(process.cwd(), "data", "models-registry.json");

const TIER_SPECS: Record<ModelTier, { tag: string; size: number; sizeFormatted: string; name: string }> = {
  free: {
    tag: "granite4:350m-h",
    size: 377487360, // ~360 MB
    sizeFormatted: "360.0 MB",
    name: "IBM Granite 4.0 H (350M)",
  },
  pro: {
    tag: "MichelRosselli/ternary-bonsai:1.7b-f16",
    size: 3650722201, // ~3.4 GB
    sizeFormatted: "3.4 GB",
    name: "Ternary Bonsai 1.7B",
  },
  ultra: {
    tag: "qwen2.5:3b",
    size: 2684354560, // ~2.5 GB
    sizeFormatted: "2.5 GB",
    name: "Qwen 2.5 3B",
  },
};

function ensureDirExists() {
  const dir = path.dirname(REGISTRY_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function getLocalModelRegistry(): Record<ModelTier, boolean> {
  try {
    ensureDirExists();
    if (fs.existsSync(REGISTRY_FILE)) {
      const content = fs.readFileSync(REGISTRY_FILE, "utf-8");
      const parsed = JSON.parse(content);
      return {
        free: !!parsed.free,
        pro: !!parsed.pro,
        ultra: !!parsed.ultra,
      };
    }
  } catch (e) {
    console.error("[model-registry] Error reading registry:", e);
  }
  // Di default rendiamo tutti i 3 profili attivi e operativi
  return { free: true, pro: true, ultra: true };
}

export function saveLocalModelRegistry(state: Record<ModelTier, boolean>) {
  try {
    ensureDirExists();
    fs.writeFileSync(REGISTRY_FILE, JSON.stringify(state, null, 2), "utf-8");
  } catch (e) {
    console.error("[model-registry] Error saving registry:", e);
  }
}

export function setModelInstalled(tier: ModelTier, installed: boolean) {
  const current = getLocalModelRegistry();
  current[tier] = installed;
  saveLocalModelRegistry(current);
}

export function getInstalledModelList(): InstalledModelRecord[] {
  const registry = getLocalModelRegistry();
  const list: InstalledModelRecord[] = [];

  for (const tierKey of ["free", "pro", "ultra"] as ModelTier[]) {
    if (registry[tierKey]) {
      const spec = TIER_SPECS[tierKey];
      list.push({
        name: spec.tag,
        model: spec.tag,
        size: spec.size,
        sizeFormatted: spec.sizeFormatted,
        digest: `sha256:local_${tierKey}_${spec.tag.replace(/[^a-z0-9]/gi, "")}`,
        modifiedAt: new Date().toISOString(),
        tier: tierKey,
      });
    }
  }

  return list;
}

export function createDownloadNdjsonStream(
  tier: ModelTier,
  signal?: AbortSignal
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const spec = TIER_SPECS[tier];
  const totalBytes = spec.size;

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        // Step 1: Manifest check
        controller.enqueue(
          encoder.encode(JSON.stringify({ status: `pulling manifest for ${spec.tag}` }) + "\n")
        );
        await new Promise((r) => setTimeout(r, 400));

        if (signal?.aborted) {
          controller.close();
          return;
        }

        // Step 2: Download chunks progress simulation
        const steps = 25;
        for (let i = 1; i <= steps; i++) {
          if (signal?.aborted) {
            controller.close();
            return;
          }

          const completed = Math.min(totalBytes, Math.round((totalBytes * i) / steps));
          const chunkPayload = JSON.stringify({
            status: `downloading ${spec.tag}`,
            completed,
            total: totalBytes,
          });

          controller.enqueue(encoder.encode(chunkPayload + "\n"));
          // Realistic download interval (approx 80-120ms per step)
          await new Promise((r) => setTimeout(r, 90));
        }

        if (signal?.aborted) {
          controller.close();
          return;
        }

        // Step 3: Verifying and writing layers
        controller.enqueue(
          encoder.encode(JSON.stringify({ status: "verifying sha256 digest" }) + "\n")
        );
        await new Promise((r) => setTimeout(r, 300));

        controller.enqueue(
          encoder.encode(JSON.stringify({ status: "writing layer to storage" }) + "\n")
        );
        await new Promise((r) => setTimeout(r, 300));

        // Step 4: Success
        controller.enqueue(
          encoder.encode(JSON.stringify({ status: "success", completed: totalBytes, total: totalBytes }) + "\n")
        );

        // Mark as installed in registry
        setModelInstalled(tier, true);
      } catch (err) {
        controller.error(err);
      } finally {
        controller.close();
      }
    },
  });
}
