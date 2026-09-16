import { MLCEngine, InitProgressReport, CreateMLCEngine } from "@mlc-ai/web-llm";
import { MODEL_TIERS, ModelTier } from "./models";

const WEB_LLM_MODELS: Record<ModelTier, string> = {
  free: "SmolLM2-360M-Instruct-q4f16_1-MLC",
  pro: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
  ultra: "Qwen2.5-3B-Instruct-q4f16_1-MLC",
};

class WebLLMEngineManager {
  private engine: MLCEngine | null = null;
  public currentTier: ModelTier | null = null;
  public isInitializing = false;
  
  hasSupport(): boolean {
    return typeof navigator !== 'undefined' && 'gpu' in navigator;
  }

  async checkStatus(): Promise<Record<ModelTier, boolean>> {
    // WebLLM doesn't have a simple synchronous "is downloaded" check without querying the CacheAPI.
    // We can do a rudimentary check via CacheStorage.
    const status: Record<ModelTier, boolean> = { free: false, pro: false, ultra: false };
    if (typeof caches === "undefined") return status;
    
    try {
      const keys = await caches.keys();
      const webLlmCaches = keys.filter(k => k.includes("webllm"));
      if (webLlmCaches.length === 0) return status;
      
      // For now, if the engine is loaded, mark it as true
      if (this.engine && this.currentTier) {
        status[this.currentTier] = true;
      }
      return status;
    } catch {
      return status;
    }
  }

  async loadModel(
    tier: ModelTier, 
    onProgress?: (progress: InitProgressReport) => void
  ) {
    if (this.currentTier === tier && this.engine) {
      return;
    }
    
    this.isInitializing = true;
    try {
      const modelInfo = MODEL_TIERS.find(t => t.id === tier);
      if (!modelInfo) throw new Error("Tier non trovato");

      const modelId = WEB_LLM_MODELS[tier] || "SmolLM2-360M-Instruct-q4f16_1-MLC";

      if (this.engine) {
        this.engine.setInitProgressCallback((progress) => {
          if (onProgress) onProgress(progress);
        });
        await this.engine.reload(modelId);
      } else {
        this.engine = await CreateMLCEngine(modelId, {
          initProgressCallback: (progress) => {
            if (onProgress) onProgress(progress);
          },
        });
      }
      this.currentTier = tier;
    } catch (err: any) {
      this.engine = null;
      this.currentTier = null;
      throw new Error(`Impossibile caricare il modello WebLLM: ${err.message}. Assicurati di avere WebGPU e sufficiente VRAM.`);
    } finally {
      this.isInitializing = false;
    }
  }

  async deleteModel(tier: ModelTier) {
    // It's hard to selectively delete from CacheStorage safely via WebLLM API directly, 
    // but we can clear caches.
    if (typeof caches !== "undefined") {
      const keys = await caches.keys();
      for (const key of keys) {
        if (key.includes("webllm")) {
          await caches.delete(key);
        }
      }
    }
    if (this.currentTier === tier) {
      this.engine = null;
      this.currentTier = null;
    }
  }

  async *generateStream(messages: any[], onUpdate?: (text: string) => void) {
    if (!this.engine) {
      throw new Error("Motore AI non caricato. Seleziona e installa un modello prima di avviare la chat.");
    }
    
    const chunks = await this.engine.chat.completions.create({
      messages,
      temperature: 0.7,
      stream: true,
    });

    let fullText = "";
    for await (const chunk of chunks) {
      const delta = chunk.choices[0]?.delta?.content || "";
      fullText += delta;
      if (onUpdate) onUpdate(fullText);
      yield delta;
    }
    return fullText;
  }
}

export const webLlmEngine = typeof window !== 'undefined' ? new WebLLMEngineManager() : null;
