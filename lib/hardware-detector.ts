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

  // 2. Rilevamento LM Studio Locale (ping asincrono al server su 127.0.0.1)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500); // 1.5s timeout

    const res = await fetch("http://127.0.0.1:1234/v1/models", {
      method: "GET",
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);

    if (res.ok) {
      capabilities.lmstudioLocalAvailable = true;
    }
  } catch (e) {
    // Expected to fail if LM Studio is off or CORS is blocked
    console.debug("LM Studio local not available directly via browser:", e);
  }

  return capabilities;
}
