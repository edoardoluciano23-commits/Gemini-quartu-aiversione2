export interface HardwareCapabilities {
  webGpuSupported: boolean;
  lmstudioLocalAvailable: boolean;
  vramEstimateMB?: number;
}

export async function detectHardware(): Promise<HardwareCapabilities> {
  const capabilities: HardwareCapabilities = {
    webGpuSupported: false,
    lmstudioLocalAvailable: false,
  };

  // 1. Rilevamento WebGPU
  if (typeof navigator !== "undefined" && (navigator as any).gpu) {
    try {
      const adapter = await (navigator as any).gpu.requestAdapter();
      if (adapter) {
        capabilities.webGpuSupported = true;
        
        // Stima euristica basata sui limiti
        const limits = adapter.limits;
        if (limits.maxBufferSize) {
          capabilities.vramEstimateMB = Math.round(limits.maxBufferSize / (1024 * 1024));
        }
      }
    } catch (e) {
      console.warn("WebGPU not fully supported or restricted", e);
    }
  }

  // 2. Rilevamento server AI locale (LM Studio su :1234 o Ollama su :11434)
  const localEndpoints = [
    "http://127.0.0.1:1234/v1/models",
    "http://127.0.0.1:11434/v1/models",
  ];

  for (const endpoint of localEndpoints) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500); // 1.5s timeout

      const res = await fetch(endpoint, {
        method: "GET",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        capabilities.lmstudioLocalAvailable = true;
        break; // found one working, no need to check further
      }
    } catch {
      // Expected to fail if server is off or CORS is blocked
    }
  }

  return capabilities;
}
