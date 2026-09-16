const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'components/chat/mandatory-model-installer.tsx');
let content = fs.readFileSync(file, 'utf8');

// Replace everything with WebLLM logic
const newContent = `"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Loader2, CheckCircle2, ShieldCheck, Zap, AlertCircle, HardDrive, Cpu, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { webLlmEngine } from "@/lib/web-llm-engine";
import { DEFAULT_TIER, MODEL_TIERS } from "@/lib/models";

export function MandatoryModelInstaller({ onInstalled }: { onInstalled: () => void }) {
  const isMountedRef = useRef(true);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState<{ percent: number; status: string; detail: string }>({
    percent: 0,
    status: "In attesa...",
    detail: "Preparazione del motore WebGPU.",
  });
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startInstall = async () => {
    if (downloading || completed || !webLlmEngine) return;
    setDownloading(true);
    setError(null);

    if (!webLlmEngine.hasSupport()) {
      setError("WebGPU non supportato sul tuo browser. Usa Chrome/Edge su desktop.");
      setDownloading(false);
      return;
    }

    try {
      await webLlmEngine.loadModel(DEFAULT_TIER, (p) => {
        if (!isMountedRef.current) return;
        setProgress({
          percent: Math.round((p.progress || 0) * 100),
          status: "Caricamento in corso...",
          detail: p.text,
        });
      });
      
      if (!isMountedRef.current) return;
      setCompleted(true);
      setProgress({ percent: 100, status: "Modello pronto!", detail: "Caricato nella VRAM." });
      setTimeout(() => {
        if (isMountedRef.current) onInstalled();
      }, 800);
    } catch (err: any) {
      if (isMountedRef.current) {
        setError(err.message || "Impossibile caricare il modello.");
      }
    } finally {
      if (isMountedRef.current) setDownloading(false);
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    const timer = setTimeout(() => {
      startInstall();
    }, 400);
    return () => {
      isMountedRef.current = false;
      clearTimeout(timer);
    };
  }, []);

  const freeInfo = MODEL_TIERS.find((t) => t.id === DEFAULT_TIER)!;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-2xl p-4 animate-in fade-in duration-300">
      <div className="glass-card relative flex w-full max-w-lg flex-col gap-5 rounded-3xl p-6 sm:p-8 shadow-2xl border border-white/20 dark:border-white/10">
        <div className="flex flex-col items-center text-center gap-3">
          <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-500/20 via-teal-500/20 to-sky-500/20 p-3 shadow-inner border border-emerald-500/30">
            <Zap className="h-8 w-8 text-emerald-500 dark:text-emerald-400 animate-pulse" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 mb-2">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Installazione Iniziale Obbligatoria</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">{freeInfo.name}</h2>
            <p className="mt-1.5 text-xs sm:text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
              Per poter accedere a Quartu AI, è necessario scaricare il modello iniziale.
              Verrà eseguito direttamente nel tuo browser tramite WebGPU per massima privacy e prestazioni.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 rounded-2xl bg-white/40 dark:bg-zinc-900/40 p-3 border border-border/60 text-center text-xs">
          <div className="flex flex-col items-center gap-1">
            <Zap className="h-4 w-4 text-emerald-500" />
            <span className="font-semibold text-foreground">Free Tier</span>
            <span className="text-[10px] text-muted-foreground font-mono">{freeInfo.modelLabel}</span>
          </div>
          <div className="flex flex-col items-center gap-1 border-x border-border/40">
            <HardDrive className="h-4 w-4 text-teal-500" />
            <span className="font-semibold text-foreground">~2 GB</span>
            <span className="text-[10px] text-muted-foreground font-mono">Download in Cache</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <Cpu className="h-4 w-4 text-sky-500" />
            <span className="font-semibold text-foreground">100% Locale</span>
            <span className="text-[10px] text-muted-foreground font-mono">WebGPU nativa</span>
          </div>
        </div>

        <div className="flex flex-col gap-2 rounded-2xl bg-muted/40 p-4 border border-border/50">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="flex items-center gap-2 text-foreground">
              {completed ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : downloading ? <Loader2 className="h-4 w-4 animate-spin text-emerald-500" /> : <Download className="h-4 w-4 text-muted-foreground" />}
              {progress.status}
            </span>
            <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">{progress.percent}%</span>
          </div>
          <div className="relative h-3 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
            <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500 transition-all duration-300" style={{ width: \`\${Math.max(3, progress.percent)}%\` }} />
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{progress.detail}</span>
          </div>
        </div>

        {error ? (
          <div className="flex flex-col gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-700 dark:text-amber-300 animate-in fade-in">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-foreground">Errore caricamento Modello</p>
                <p className="mt-0.5 text-[11px] opacity-90">{error}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1 gap-1.5 border-border/80 text-xs" onClick={startInstall}>
                <RefreshCw className="h-3.5 w-3.5" /> Riprova
              </Button>
              <Button size="sm" className="flex-1 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold" onClick={onInstalled}>
                <Zap className="h-3.5 w-3.5" /> Entra comunque
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex justify-center">
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground" onClick={onInstalled} disabled={downloading}>
              Entra senza scaricare ora →
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
`;

fs.writeFileSync(file, newContent);
