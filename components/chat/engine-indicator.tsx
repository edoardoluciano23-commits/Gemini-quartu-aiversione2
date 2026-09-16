"use client";

import { useEffect, useState } from "react";
import { Cpu, Server, Zap, ChevronDown, Check } from "lucide-react";
import { detectHardware, HardwareCapabilities } from "@/lib/hardware-detector";
import { Button } from "@/components/ui/button";

export type EngineMode = "auto" | "webgpu" | "lmstudio";

interface EngineIndicatorProps {
  mode: EngineMode;
  onModeChange: (mode: EngineMode) => void;
}

export function EngineIndicator({ mode, onModeChange }: EngineIndicatorProps) {
  const [hardware, setHardware] = useState<HardwareCapabilities | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    async function check() {
      const h = await detectHardware();
      setHardware(h);
    }
    check();
  }, []);

  // Determine active engine for auto mode
  let activeEngine = mode;
  if (mode === "auto") {
    if (hardware?.webGpuSupported) activeEngine = "webgpu";
    else activeEngine = "lmstudio";
  }

  const getEngineConfig = (engine: EngineMode) => {
    switch (engine) {
      case "webgpu":
        return {
          icon: <Zap className="h-3 w-3 text-emerald-500" />,
          label: "WebGPU",
          color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
          desc: "Browser Native",
        };
      case "lmstudio":
        return {
          icon: <Server className="h-3 w-3 text-sky-500" />,
          label: "Local AI",
          color: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
          desc: "Ollama / LM Studio",
        };
      default:
        return {
          icon: <Zap className="h-3 w-3" />,
          label: "Auto",
          color: "bg-muted text-muted-foreground border-border",
          desc: "Detecting...",
        };
    }
  };

  const config = getEngineConfig(activeEngine);

  return (
    <div className="relative">
      <Button
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        className={`h-11 min-h-[44px] min-w-[44px] gap-1.5 rounded-full px-3 text-xs md:text-sm font-medium border ${config.color}`}
        title="Seleziona motore AI"
      >
        {config.icon}
        <span className="hidden sm:inline">{config.label}</span>
        <span className="text-[10px] opacity-70 ml-1 hidden lg:inline">({mode === "auto" ? "Auto" : "Forzato"})</span>
      </Button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-xs"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          <div className="glass-island absolute right-0 top-13 z-50 w-72 rounded-3xl p-3 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-150">
            <div className="px-2 pt-1 pb-1.5 text-[11px] font-bold text-muted-foreground/80 uppercase tracking-wider flex items-center justify-between">
              <span>Stato Hardware</span>
              <span className="text-[10px] lowercase text-sky-500 font-mono">live check</span>
            </div>
            <div className="px-2 pb-3 space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-foreground/90 font-medium">WebGPU:</span>
                {hardware?.webGpuSupported ? (
                  <span className="text-emerald-500 font-semibold inline-flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Attivo {hardware.vramEstimateMB ? `(~${hardware.vramEstimateMB}MB)` : ""}
                  </span>
                ) : (
                  <span className="text-destructive font-medium">Non Supportato</span>
                )}
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-foreground/90 font-medium">Local AI (Ollama/LM Studio):</span>
                {hardware?.lmstudioLocalAvailable ? (
                  <span className="text-sky-500 font-semibold inline-flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                    Connesso
                  </span>
                ) : (
                  <span className="text-muted-foreground">Disconnesso</span>
                )}
              </div>
            </div>

            <div className="px-2 pt-2.5 pb-1 text-[11px] font-bold text-muted-foreground/80 uppercase tracking-wider border-t border-border/40">
              Selezione Motore
            </div>
            <div className="space-y-1 mt-1">
              {(["auto", "webgpu", "lmstudio"] as EngineMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    onModeChange(m);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all cursor-pointer ${
                    mode === m
                      ? "glass-pill bg-white/90 dark:bg-zinc-800/90 text-foreground font-bold shadow-sm border-sky-500/30"
                      : "text-muted-foreground hover:bg-white/50 dark:hover:bg-zinc-800/40 hover:text-foreground"
                  }`}
                >
                  <span className="capitalize">{m === "lmstudio" ? "Local AI" : m}</span>
                  {mode === m && <Check className="h-3.5 w-3.5 text-sky-500" />}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
