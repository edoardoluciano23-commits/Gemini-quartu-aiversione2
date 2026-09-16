"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Download,
  Database,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  Trash2,
  RefreshCw,
  Server,
  Settings2,
  HardDrive,
  Cpu,
  Sparkles,
  Zap,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MODEL_TIERS, type ModelTier } from "@/lib/models";

const HOST_STORAGE_KEY = "quartu-ai:lmstudio-host";

export interface ModelItem {
  name: string;
  model: string;
  size: number;
  sizeFormatted: string;
  digest: string;
}

export interface LMStudioStatusData {
  connected: boolean;
  engine?: string;
  host: string;
  version: string;
  installed: ModelItem[];
  required: {
    free: string;
    pro: string;
    ultra: string;
  };
  status: {
    free: boolean;
    pro: boolean;
    ultra: boolean;
  };
}

export interface ModelManagerProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onStatusChange?: (data: LMStudioStatusData | null) => void;
}

export function ModelManager({ open: controlledOpen, onOpenChange, onStatusChange }: ModelManagerProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;

  const [data, setData] = useState<LMStudioStatusData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pullingTier, setPullingTier] = useState<ModelTier | null>(null);
  const [pullProgress, setPullProgress] = useState<{ status: string; percent?: number; detail?: string } | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [hostInput, setHostInput] = useState("");
  const [deletingTier, setDeletingTier] = useState<ModelTier | null>(null);
  const [confirmDeleteTier, setConfirmDeleteTier] = useState<ModelTier | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const onStatusChangeRef = useRef(onStatusChange);

  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
  }, [onStatusChange]);

  const setIsOpen = useCallback(
    (nextOpen: boolean) => {
      if (isControlled) {
        onOpenChange?.(nextOpen);
      } else {
        setInternalOpen(nextOpen);
      }
    },
    [isControlled, onOpenChange],
  );

  useEffect(() => {
    try {
      const saved = localStorage.getItem(HOST_STORAGE_KEY);
      if (saved) setHostInput(saved);
    } catch {
      // Storage non disponibile
    }
  }, []);

  const fetchStatus = useCallback(
    async (customHost?: string) => {
      setLoading(true);
      setError(null);
      try {
        const hostToUse = customHost !== undefined ? customHost : hostInput.trim();
        const query = hostToUse ? `?host=${encodeURIComponent(hostToUse)}` : "";
        const res = await fetch(`/api/models${query}`);
        const json = (await res.json()) as LMStudioStatusData;
        setData(json);
        onStatusChangeRef.current?.(json);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Errore di connessione al server.");
        setData(null);
        onStatusChangeRef.current?.(null);
      } finally {
        setLoading(false);
      }
    },
    [hostInput],
  );

  // Caricamento iniziale
  useEffect(() => {
    void fetchStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ricarica lo stato quando viene aperta la finestra modale
  const prevOpenRef = useRef(isOpen);
  useEffect(() => {
    if (isOpen && !prevOpenRef.current) {
      void fetchStatus();
    }
    prevOpenRef.current = isOpen;
  }, [isOpen, fetchStatus]);

  // Gestione tasto Escape per chiudere la modale
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !pullingTier) {
        setIsOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, pullingTier, setIsOpen]);

  function saveHostConfig(): void {
    const trimmed = hostInput.trim();
    try {
      if (trimmed) {
        localStorage.setItem(HOST_STORAGE_KEY, trimmed);
      } else {
        localStorage.removeItem(HOST_STORAGE_KEY);
      }
    } catch {
      // Storage non disponibile
    }
    void fetchStatus(trimmed);
  }

  async function pullModel(tier: ModelTier) {
    if (pullingTier !== null) return;
    setPullingTier(tier);
    setPullProgress({ status: "Avvio installazione modello locale..." });
    setError(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const hostToUse = hostInput.trim();
      const res = await fetch("/api/models/pull", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier,
          host: hostToUse || undefined,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errJson = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errJson.error || `Errore HTTP ${res.status} durante il download.`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("Flusso di risposta non disponibile.");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        
        if (value) {
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine) continue;

            try {
              const evt = JSON.parse(trimmedLine) as {
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
                setPullProgress({
                  status: evt.status || "Download in corso...",
                  percent,
                  detail: `${compMb} MB / ${totMb} MB (${percent}%)`,
                });
              } else {
                setPullProgress((prev) => ({
                  status: evt.status || "Elaborazione modello...",
                  percent: prev?.percent,
                  detail: prev?.detail,
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
          if (buffer.trim()) {
             try {
               const evt = JSON.parse(buffer.trim()) as any;
               if (evt.error) throw new Error(evt.error);
             } catch (e) {
               if (e instanceof Error && !e.message.includes("JSON")) throw e;
             }
          }
          break;
        }
      }

      setPullProgress({ status: "Download completato con successo!", percent: 100 });
      await fetchStatus();
      await new Promise(r => setTimeout(r, 2000));
    } catch (e) {
      if (!controller.signal.aborted) {
        setError(e instanceof Error ? e.message : "Errore durante il download del modello.");
      }
    } finally {
      abortControllerRef.current = null;
      setPullingTier(null);
      setPullProgress(null);
    }
  }

  function cancelPull(): void {
    abortControllerRef.current?.abort();
    setPullingTier(null);
    setPullProgress(null);
  }

  async function deleteModel(tier: ModelTier) {
    if (deletingTier !== null) return;
    setDeletingTier(tier);
    setConfirmDeleteTier(null);
    setError(null);
    try {
      const res = await fetch("/api/models/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier,
          host: hostInput.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const errJson = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errJson.error || "Impossibile eliminare il modello.");
      }

      await fetchStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore durante l'eliminazione.");
    } finally {
      setDeletingTier(null);
    }
  }

  const isFreeInstalled = !!data?.status.free;
  const isProInstalled = !!data?.status.pro;
  const isUltraInstalled = !!data?.status.ultra;
  const isConnected = !!data?.connected;

  return (
    <>
      <button
        type="button"
        id="btn-modelli-locali"
        onClick={() => setIsOpen(true)}
        className="glass-subtle flex h-9 items-center gap-2 rounded-full px-3 text-xs font-medium transition-all hover:bg-white/80 active:scale-95 dark:hover:bg-zinc-800/80 cursor-pointer"
        title="Gestisci i modelli locali Quartu AI"
      >
        <Database className="h-3.5 w-3.5 text-sky-500" />
        <span className="inline font-medium">Modelli Locali</span>
        <span
          className="h-2 w-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50"
          title="Motore Locale Attivo"
        />
      </button>

      {isOpen && (
        <div
          id="modal-backdrop-modelli"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md p-4 animate-in fade-in duration-150"
          onClick={() => {
            if (!pullingTier) setIsOpen(false);
          }}
        >
          <div
            id="modal-card-modelli"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dialog-title-modelli"
            className="glass-card relative flex w-full max-w-lg flex-col gap-4 rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h2 id="dialog-title-modelli" className="text-lg font-bold tracking-tight text-foreground">
                    Gestione Modelli Locali
                  </h2>
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
                    {data?.engine === "local-integrated"
                      ? "Motore Quartu AI Locale (Attivo)"
                      : isConnected
                      ? `Bridge Locale (${data?.version || "attivo"})`
                      : "Motore Quartu AI Locale (Attivo)"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  I modelli girano al 100% in locale sul tuo dispositivo senza alcuna connessione cloud.
                </p>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11 min-h-[44px] min-w-[44px] md:h-8 md:w-8 rounded-full"
                  onClick={() => setShowConfig((v) => !v)}
                  title="Configura Host Locale (Opzionale)"
                >
                  <Settings2 className="h-5 w-5 md:h-4 md:w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11 min-h-[44px] min-w-[44px] md:h-8 md:w-8 rounded-full"
                  onClick={() => void fetchStatus()}
                  disabled={loading}
                  title="Aggiorna stato"
                >
                  <RefreshCw className={`h-5 w-5 md:h-4 md:w-4 ${loading ? "animate-spin" : ""}`} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11 min-h-[44px] min-w-[44px] md:h-8 md:w-8 rounded-full"
                  onClick={() => {
                    if (!pullingTier) setIsOpen(false);
                  }}
                  disabled={pullingTier !== null}
                  title="Chiudi finestra"
                >
                  <X className="h-5 w-5 md:h-4 md:w-4" />
                </Button>
              </div>
            </div>

            {showConfig && (
              <div className="glass-subtle rounded-2xl p-3 border border-border/60 flex flex-col gap-2 animate-in slide-in-from-top-2 duration-150">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Server className="h-3.5 w-3.5 text-sky-500" />
                  <span>Connessione Host Locale LM Studio / Ollama (Opzionale)</span>
                </div>
                <div className="flex gap-2">
                  <Input
                    value={hostInput}
                    onChange={(e) => setHostInput(e.target.value)}
                    placeholder="http://127.0.0.1:1234"
                    className="h-11 md:h-8 text-base md:text-xs font-mono bg-white/50 dark:bg-zinc-800/50"
                  />
                  <Button size="sm" className="h-11 md:h-8 px-4 md:px-3 text-sm md:text-xs min-w-[44px]" onClick={saveHostConfig}>
                    Salva
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Opzionale: se non hai LM Studio attivo, Quartu AI utilizza in automatico il motore locale autonomo integrato.
                </p>
              </div>
            )}

            {error && (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2.5">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
                <div className="flex-1">
                  <p className="font-semibold text-foreground">Server locale non raggiungibile</p>
                  <p className="mt-0.5 text-[11px] opacity-90">
                    Ollama o LM Studio non sembrano in esecuzione. Avvia il server locale sulla porta :1234 (LM Studio) o :11434 (Ollama) e ricarica lo stato.
                  </p>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3">
              {MODEL_TIERS.map((tier) => {
                const isInstalled = !!data?.status[tier.id];
                const modelTag =
                  data?.required[tier.id] ||
                  (tier.id === "free"
                    ? "granite4:350m-h"
                    : tier.id === "pro"
                    ? "MichelRosselli/ternary-bonsai:1.7b-f16"
                    : "qwen2.5:3b");
                const isThisPulling = pullingTier === tier.id;
                const isThisDeleting = deletingTier === tier.id;
                const isThisConfirmingDelete = confirmDeleteTier === tier.id;
                const Icon = tier.id === "free" ? Zap : tier.id === "pro" ? Cpu : Sparkles;

                const installedInfo = data?.installed.find(
                  (m) =>
                    m.name.toLowerCase().includes(
                      tier.id === "free" ? "granite" : tier.id === "pro" ? "ternary-bonsai" : "qwen"
                    ) || m.name === modelTag,
                );

                return (
                  <div
                    key={tier.id}
                    id={`model-card-${tier.id}`}
                    className="glass-subtle relative rounded-2xl border border-border/70 p-4 transition-all hover:border-sky-500/30"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div
                          className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                            tier.id === "free"
                              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                              : tier.id === "pro"
                              ? "bg-sky-500/15 text-sky-600 dark:text-sky-400"
                              : "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400"
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold text-foreground">{tier.name}</h3>
                            <span className="rounded-full bg-muted/80 px-2 py-0.5 text-[10px] font-mono text-muted-foreground border border-border/60">
                              {tier.modelLabel}
                            </span>
                            {tier.isMandatory && (
                              <span className="rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 px-1.5 py-0.2 text-[9px] font-semibold border border-amber-500/20">
                                Obbligatorio
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{tier.description}</p>
                          <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground font-mono">
                            <span className="text-xs text-foreground/80 font-sans">{tier.requirement}</span>
                            {installedInfo && (
                              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                                <HardDrive className="h-3 w-3" />
                                {installedInfo.sizeFormatted}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-1.5 mt-2 sm:mt-0">
                        {isInstalled && !isThisPulling ? (
                          isThisConfirmingDelete ? (
                            <div className="flex items-center gap-1.5 animate-in fade-in duration-150">
                              <span className="text-[10px] text-muted-foreground font-medium hidden sm:inline">
                                Confermi?
                              </span>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="h-11 md:h-7 min-w-[44px] px-3 md:px-2 text-sm md:text-[11px] font-bold"
                                disabled={isThisDeleting}
                                onClick={() => void deleteModel(tier.id)}
                              >
                                {isThisDeleting ? <Loader2 className="h-4 w-4 md:h-3 md:w-3 animate-spin" /> : "Elimina"}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-11 md:h-7 min-w-[44px] px-3 md:px-2 text-sm md:text-[11px]"
                                onClick={() => setConfirmDeleteTier(null)}
                              >
                                Annulla
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Installato
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-11 w-11 md:h-8 md:w-8 min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 text-muted-foreground hover:text-destructive"
                                title="Elimina modello per liberare spazio"
                                disabled={isThisDeleting || pullingTier !== null}
                                onClick={() => setConfirmDeleteTier(tier.id)}
                              >
                                {isThisDeleting ? (
                                  <Loader2 className="h-4 w-4 md:h-3.5 md:w-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4 md:h-3.5 md:w-3.5" />
                                )}
                              </Button>
                            </div>
                          )
                        ) : (
                          <Button
                            size="sm"
                            variant={isThisPulling ? "outline" : "default"}
                            className="h-11 md:h-8 min-w-[44px] gap-1.5 px-4 md:px-3 text-sm md:text-xs font-semibold shadow-sm"
                            disabled={pullingTier !== null && !isThisPulling}
                            onClick={() => {
                              if (isThisPulling) {
                                cancelPull();
                              } else {
                                void pullModel(tier.id);
                              }
                            }}
                          >
                            {isThisPulling ? (
                              <>
                                <Loader2 className="h-4 w-4 md:h-3.5 md:w-3.5 animate-spin" />
                                <span>Interrompi</span>
                              </>
                            ) : (
                              <>
                                <Download className="h-4 w-4 md:h-3.5 md:w-3.5" />
                                <span>Scarica Modello</span>
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>

                    {isThisPulling && pullProgress && (
                      <div className="mt-3 rounded-xl bg-muted/60 p-2.5 border border-border/50 flex flex-col gap-1.5 animate-in fade-in duration-200">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-foreground truncate pr-2">{pullProgress.status}</span>
                          {pullProgress.percent !== undefined && (
                            <span className="font-bold text-sky-600 dark:text-sky-400 font-mono">
                              {pullProgress.percent}%
                            </span>
                          )}
                        </div>
                        {pullProgress.percent !== undefined && (
                          <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                            <div
                              className="h-full bg-gradient-to-r from-sky-500 to-indigo-600 transition-all duration-300 ease-out"
                              style={{ width: `${pullProgress.percent}%` }}
                            />
                          </div>
                        )}
                        {pullProgress.detail && (
                          <span className="text-[11px] text-muted-foreground font-mono self-end">
                            {pullProgress.detail}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="border-t border-border/50 pt-3 text-[11px] text-muted-foreground flex flex-wrap items-center justify-between gap-2">
              <span>Free: <strong>IBM Granite 4.0 H</strong> (~360 MB)</span>
              <span>Pro: <strong>Ternary Bonsai 1.7B</strong> (~3.4 GB)</span>
              <span>Ultra: <strong>Qwen 2.5 3B</strong> (~2.5 GB)</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
