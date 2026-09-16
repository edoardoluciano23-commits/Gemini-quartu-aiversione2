"use client";

import { useEffect, useRef, useState } from "react";
import {
  Download,
  Loader2,
  CheckCircle2,
  AlertCircle,
  HardDrive,
  ShieldCheck,
  Zap,
  Cpu,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const HOST_STORAGE_KEY = "quartu-ai:lmstudio-host";

interface MandatoryModelInstallerProps {
  onInstalled: () => void;
}

export function MandatoryModelInstaller({ onInstalled }: MandatoryModelInstallerProps) {
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState<{
    percent: number;
    status: string;
    detail?: string;
  }>({
    percent: 0,
    status: "Inizializzazione download...",
    detail: "Preparazione pacchetto Qwen 2.5 (0.5B)",
  });
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);

  const startPull = async () => {
    if (downloading) return;
    setError(null);
    setDownloading(true);
    setProgress({
      percent: 0,
      status: "Inizializzazione motore locale Quartu AI...",
      detail: "Verifica disponibilità modello",
    });

    const controller = new AbortController();
    abortRef.current = controller;

    let customHost: string | undefined;
    try {
      const saved = localStorage.getItem(HOST_STORAGE_KEY);
      if (saved && saved.trim()) customHost = saved.trim();
    } catch {
      // Storage non disponibile
    }

    try {
      const res = await fetch("/api/models/pull", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: "free", host: customHost }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errJson = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errJson.error || `Errore server HTTP ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("Flusso dati non disponibile.");

      const decoder = new TextDecoder();
      let buffer = "";

      while (isMountedRef.current) {
        const { done, value } = await reader.read();

        if (value) {
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            try {
              const evt = JSON.parse(trimmed) as {
                error?: string;
                total?: number;
                completed?: number;
                status?: string;
              };

              if (evt.error) {
                throw new Error(evt.error);
              }

              if (evt.total && evt.completed !== undefined) {
                const percent = Math.min(100, Math.round((evt.completed / evt.total) * 100));
                const compMb = (evt.completed / (1024 * 1024)).toFixed(0);
                const totMb = (evt.total / (1024 * 1024)).toFixed(0);
                setProgress({
                  percent,
                  status: evt.status || "Download modello in corso...",
                  detail: `${compMb} MB / ${totMb} MB (${percent}%)`,
                });
              } else if (evt.status) {
                setProgress((prev) => ({
                  percent: prev.percent,
                  status: evt.status || prev.status,
                  detail: prev.detail,
                }));
              }
            } catch (jsonErr) {
              if (jsonErr instanceof Error && !jsonErr.message.includes("JSON")) {
                throw jsonErr;
              }
            }
          }
        }

        if (done) {
          break;
        }
      }

      if (isMountedRef.current) {
        setCompleted(true);
        setProgress({
          percent: 100,
          status: "Installazione completata con successo!",
          detail: "Modello pronto all'uso",
        });

        setTimeout(() => {
          if (isMountedRef.current) {
            onInstalled();
          }
        }, 1200);
      }
    } catch (e) {
      if (isMountedRef.current && !controller.signal.aborted) {
        setError(
          e instanceof Error
            ? e.message
            : "Si è verificato un errore durante l'installazione del modello Free."
        );
      }
    } finally {
      if (isMountedRef.current) {
        abortRef.current = null;
        setDownloading(false);
      }
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    const timer = setTimeout(() => {
      void startPull();
    }, 400);

    // Polling periodico per verificare se il modello è già stato installato
    const pollInterval = setInterval(async () => {
      if (completed) return;
      try {
        let customHostParam = "";
        const saved = localStorage.getItem(HOST_STORAGE_KEY);
        if (saved && saved.trim()) customHostParam = `?host=${encodeURIComponent(saved.trim())}`;
        const checkRes = await fetch(`/api/models${customHostParam}`);
        if (checkRes.ok) {
          const checkData = (await checkRes.json()) as { status?: { free?: boolean }, error?: string };
          
          if (checkData.status?.free) {
            setCompleted(true);
            setProgress({
              percent: 100,
              status: "Modello pronto all'uso!",
              detail: "Verificato dal server locale",
            });
            setTimeout(() => {
              if (isMountedRef.current) {
                onInstalled();
              }
            }, 800);
          }
        }
      } catch {
        // Ignora errori di polling
      }
    }, 3000);

    return () => {
      isMountedRef.current = false;
      clearTimeout(timer);
      clearInterval(pollInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      id="mandatory-installer-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-2xl p-4 animate-in fade-in duration-300"
    >
      <div
        id="mandatory-installer-card"
        className="glass-card relative flex w-full max-w-lg flex-col gap-5 rounded-3xl p-6 sm:p-8 shadow-2xl border border-white/20 dark:border-white/10"
      >
        {/* Header con Icona e Badge */}
        <div className="flex flex-col items-center text-center gap-3">
          <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-500/20 via-teal-500/20 to-sky-500/20 p-3 shadow-inner border border-emerald-500/30">
            <Zap className="h-8 w-8 text-emerald-500 dark:text-emerald-400 animate-pulse" />
            <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white shadow">
              !
            </span>
          </div>

          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 mb-2">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Installazione Iniziale Obbligatoria</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Modello AI Base
            </h2>
            <p className="mt-1.5 text-xs sm:text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
              Per poter accedere e utilizzare Quartu AI, è necessario scaricare il modello iniziale <strong>Free</strong>.
              Il modello verrà scaricato ed eseguito direttamente sul tuo server locale.
            </p>
          </div>
        </div>

        {/* Specifiche modello */}
        <div className="grid grid-cols-3 gap-2 rounded-2xl bg-white/40 dark:bg-zinc-900/40 p-3 border border-border/60 text-center text-xs">
          <div className="flex flex-col items-center gap-1">
            <Zap className="h-4 w-4 text-emerald-500" />
            <span className="font-semibold text-foreground">Free Tier</span>
            <span className="text-[10px] text-muted-foreground font-mono">Incluso</span>
          </div>
          <div className="flex flex-col items-center gap-1 border-x border-border/40">
            <HardDrive className="h-4 w-4 text-teal-500" />
            <span className="font-semibold text-foreground">~390 MB</span>
            <span className="text-[10px] text-muted-foreground font-mono">Download unico</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <Cpu className="h-4 w-4 text-sky-500" />
            <span className="font-semibold text-foreground">100% Locale</span>
            <span className="text-[10px] text-muted-foreground font-mono">Privacy totale</span>
          </div>
        </div>

        {/* Sezione di Progresso */}
        <div className="flex flex-col gap-2 rounded-2xl bg-muted/40 p-4 border border-border/50">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="flex items-center gap-2 text-foreground">
              {completed ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              ) : downloading ? (
                <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
              ) : (
                <Download className="h-4 w-4 text-muted-foreground" />
              )}
              {progress.status}
            </span>
            <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">
              {progress.percent}%
            </span>
          </div>

          {/* Barra di avanzamento con shimmer specular */}
          <div className="relative h-3 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500 transition-all duration-300"
              style={{ width: `${Math.max(3, progress.percent)}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{progress.detail || "Scaricamento dei layer..."}</span>
            <span>Tag: <code className="font-mono text-[10px]">qwen2.5:0.5b</code></span>
          </div>
        </div>

        {/* Gestione Errori o Modalità Immediata */}
        {error ? (
          <div className="flex flex-col gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-700 dark:text-amber-300 animate-in fade-in">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-foreground">Connessione server esterno non attiva</p>
                <p className="mt-0.5 text-[11px] opacity-90">{error}</p>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Nessun problema: il motore locale integrato di Quartu AI è sempre pronto all&apos;uso senza dipendenze o comandi da terminale.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1 gap-1.5 border-border/80 text-xs"
                onClick={() => void startPull()}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Riprova Server
              </Button>
              <Button
                size="sm"
                className="flex-1 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                onClick={onInstalled}
              >
                <Zap className="h-3.5 w-3.5" />
                Avvia Chat Subito
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={onInstalled}
            >
              Oppure entra subito con il Motore Locale Integrato →
            </Button>
          </div>
        )}

        {/* Nota di sblocco */}
        <p className="text-center text-[11px] text-muted-foreground">
          🔒 Puoi gestire, scaricare o rimuovere i modelli in qualsiasi momento dal pulsante <strong>Modelli Locali</strong> in alto.
        </p>
      </div>
    </div>
  );
}
