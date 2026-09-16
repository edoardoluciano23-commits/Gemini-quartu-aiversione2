"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Sparkles,
  Zap,
  AlertCircle,
  CheckCircle2,
  HardDrive,
  SlidersHorizontal,
  Layers,
} from "lucide-react";
import { MODEL_TIERS, type ModelTier, type ModelItem } from "@/lib/models";
import { cn } from "@/lib/utils";

const TIER_ICONS = { free: Zap, pro: Cpu, ultra: Sparkles } as const;
const TIER_KEYS: readonly ModelTier[] = ["free", "pro", "ultra"] as const;

export interface ModelPickerProps {
  value: ModelTier;
  disabled: boolean;
  statusMap?: { free: boolean; pro: boolean; ultra: boolean };
  installedModels?: ModelItem[];
  onChange: (tier: ModelTier) => void;
  onOpenManager?: () => void;
}

export function ModelPicker({
  value,
  disabled,
  statusMap,
  installedModels = [],
  onChange,
  onOpenManager,
}: ModelPickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(e: MouseEvent): void {
      if (rootRef.current !== null && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "ArrowLeft" && !disabled) {
        // Naviga al modello precedente
        e.preventDefault();
        goToPrev();
      }
      if (e.key === "ArrowRight" && !disabled) {
        // Naviga al modello successivo
        e.preventDefault();
        goToNext();
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [disabled, value]);

  const currentIndex = TIER_KEYS.indexOf(value);
  const active = MODEL_TIERS.find((t) => t.id === value) ?? MODEL_TIERS[0]!;
  const ActiveIcon = TIER_ICONS[active.id];
  const isActiveInstalled = statusMap ? statusMap[active.id] : undefined;

  function goToPrev() {
    const prevIndex = (currentIndex - 1 + TIER_KEYS.length) % TIER_KEYS.length;
    const target = TIER_KEYS[prevIndex];
    if (target) onChange(target);
  }

  function goToNext() {
    const nextIndex = (currentIndex + 1) % TIER_KEYS.length;
    const target = TIER_KEYS[nextIndex];
    if (target) onChange(target);
  }

  // Calcolo modelli installati
  const totalInstalledCount = statusMap
    ? (statusMap.free ? 1 : 0) + (statusMap.pro ? 1 : 0) + (statusMap.ultra ? 1 : 0)
    : 0;

  return (
    <div ref={rootRef} className="relative flex items-center">
      {/* Contenitore Navigatore Modelli Integrato */}
      <div className="flex items-center gap-1 p-0.5 rounded-full glass-subtle border border-white/30 dark:border-white/10 shadow-sm">
        {/* Pulsante Navigazione Modello Precedente */}
        <button
          type="button"
          disabled={disabled}
          onClick={goToPrev}
          aria-label="Passa al modello precedente (Tasto freccia sinistra)"
          title="Modello precedente (←)"
          className="flex h-10 w-9 min-h-[40px] items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-white/80 dark:hover:bg-zinc-800/80 active:scale-90 transition-all disabled:opacity-40 cursor-pointer"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {/* Segmented Pills per Desktop / Schermi Medi: Free | Pro | Ultra */}
        <div className="hidden lg:flex items-center gap-1">
          {MODEL_TIERS.map((tier) => {
            const Icon = TIER_ICONS[tier.id];
            const isSelected = tier.id === value;
            const isInstalled = statusMap ? statusMap[tier.id] : undefined;

            return (
              <button
                key={tier.id}
                type="button"
                disabled={disabled}
                onClick={() => onChange(tier.id)}
                aria-pressed={isSelected}
                className={cn(
                  "relative flex h-10 min-h-[40px] items-center gap-2 rounded-full px-3 text-xs font-semibold transition-all cursor-pointer",
                  isSelected
                    ? "glass-pill bg-white/95 dark:bg-zinc-800/95 text-foreground font-bold shadow-sm border-sky-500/40 ring-1 ring-sky-500/25"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/50 dark:hover:bg-zinc-800/40 active:scale-95",
                )}
                title={`${tier.name} (${tier.modelLabel}) - ${tier.requirement}`}
              >
                <div
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-md",
                    tier.id === "free"
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                      : tier.id === "pro"
                      ? "bg-sky-500/15 text-sky-600 dark:text-sky-400"
                      : "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400",
                  )}
                >
                  <Icon className="h-3 w-3" />
                </div>
                <span>{tier.id.toUpperCase()}</span>
                {/* Indicatore di stato installato */}
                {isInstalled !== undefined && (
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full ring-2 ring-background",
                      isInstalled
                        ? "bg-emerald-500 shadow-sm shadow-emerald-500"
                        : "bg-amber-500 shadow-sm shadow-amber-500",
                    )}
                    title={isInstalled ? "Pronto all'uso" : "Da scaricare"}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Pulsante Modello Attivo (Compatto su Mobile, Esteso come Trigger Dropdown) */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={`Modello attivo: ${active.name}. Clicca per visualizzare tutti i modelli installati`}
          className={cn(
            "flex h-10 min-h-[40px] items-center gap-2 rounded-full px-3 text-xs sm:text-sm font-semibold transition-all hover:bg-white/90 active:scale-95 disabled:opacity-50 dark:hover:bg-zinc-800/90 cursor-pointer",
            "lg:border-l lg:border-border/40 lg:pl-2.5",
          )}
        >
          <div className="lg:hidden flex h-6 w-6 items-center justify-center rounded-lg bg-sky-500/15 text-sky-500">
            <ActiveIcon className="h-3.5 w-3.5" />
          </div>
          <span className="lg:hidden font-bold tracking-tight">
            {active.id.toUpperCase()}
          </span>
          <span className="hidden sm:inline-block lg:hidden text-[11px] text-muted-foreground font-mono truncate max-w-[100px]">
            {active.modelLabel.split(" ")[0]}
          </span>
          {/* Status Dot */}
          {isActiveInstalled !== undefined && (
            <span
              className={cn(
                "h-2 w-2 rounded-full shadow-sm",
                isActiveInstalled
                  ? "bg-emerald-500 shadow-emerald-500"
                  : "bg-amber-500 shadow-amber-500",
              )}
              title={isActiveInstalled ? "Modello scaricato e pronto" : "Modello da scaricare"}
            />
          )}
          <span className="hidden lg:inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
            <Layers className="h-3.5 w-3.5" />
            <span className="font-medium">Tutti ({MODEL_TIERS.length})</span>
          </span>
          <ChevronDown
            className={cn("h-3.5 w-3.5 opacity-60 transition-transform duration-200", open && "rotate-180")}
          />
        </button>

        {/* Pulsante Navigazione Modello Successivo */}
        <button
          type="button"
          disabled={disabled}
          onClick={goToNext}
          aria-label="Passa al modello successivo (Tasto freccia destra)"
          title="Modello successivo (→)"
          className="flex h-10 w-9 min-h-[40px] items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-white/80 dark:hover:bg-zinc-800/80 active:scale-90 transition-all disabled:opacity-40 cursor-pointer"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Dropdown / Modalità Popover Fluttuante "Tutti i Modelli" */}
      {open && (
        <>
          {/* Backdrop di chiusura non invasivo */}
          <div
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-xs"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />

          <div
            role="dialog"
            aria-label="Pannello di navigazione e selezione modelli"
            className="glass-island absolute right-0 sm:left-1/2 sm:-translate-x-1/2 top-13 z-50 w-88 sm:w-96 max-w-[calc(100vw-1.5rem)] rounded-3xl p-3 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-150 border border-white/30 dark:border-white/10"
          >
            {/* Header del Navigatore */}
            <div className="flex items-center justify-between border-b border-border/50 pb-2.5 px-1">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-sky-500/15 text-sky-500">
                  <SlidersHorizontal className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-foreground">Navigatore Modelli</h3>
                  <p className="text-[10px] text-muted-foreground">
                    Seleziona o naviga tra i modelli locali
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-muted/80 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground border border-border/50">
                <HardDrive className="h-3 w-3 text-emerald-500" />
                {totalInstalledCount}/{MODEL_TIERS.length} Pronti
              </span>
            </div>

            {/* Lista dei 3 Modelli Ufficiali */}
            <div className="mt-2 space-y-1">
              <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Profili e Modelli Quartu AI
              </div>

              {MODEL_TIERS.map((tier) => {
                const Icon = TIER_ICONS[tier.id];
                const selected = tier.id === value;
                const isInstalled = statusMap ? statusMap[tier.id] : undefined;

                return (
                  <button
                    key={tier.id}
                    type="button"
                    onClick={() => {
                      onChange(tier.id);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-2xl p-2.5 text-left transition-all cursor-pointer",
                      selected
                        ? "glass-pill bg-white/95 dark:bg-zinc-800/90 shadow-sm border border-sky-500/40 ring-1 ring-sky-500/25"
                        : "hover:bg-white/60 dark:hover:bg-zinc-800/50 hover:border hover:border-white/20",
                    )}
                  >
                    <div
                      className={cn(
                        "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
                        tier.id === "free"
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                          : tier.id === "pro"
                          ? "bg-sky-500/15 text-sky-600 dark:text-sky-400"
                          : "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                          {tier.name}
                        </span>
                        {selected && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-sky-500">
                            <Check className="h-3 w-3" /> Attivo
                          </span>
                        )}
                      </div>

                      <div className="mt-0.5 flex items-center gap-1.5">
                        <span className="rounded-md bg-muted/90 px-1.5 py-0.5 text-[10px] font-mono font-medium text-foreground/80 border border-border/60">
                          {tier.modelLabel}
                        </span>
                      </div>

                      <p className="mt-1 text-[11px] text-muted-foreground line-clamp-1">
                        {tier.description}
                      </p>

                      <div className="mt-1.5 flex items-center justify-between text-[10px]">
                        <span className="text-muted-foreground font-medium">
                          {tier.requirement}
                        </span>
                        {isInstalled !== undefined && (
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 font-semibold",
                              isInstalled
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-amber-600 dark:text-amber-400",
                            )}
                          >
                            {isInstalled ? (
                              <>
                                <CheckCircle2 className="h-3 w-3" /> Pronto
                              </>
                            ) : (
                              <>
                                <AlertCircle className="h-3 w-3" /> Da scaricare
                              </>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Sezione Modelli Rilevati in LM Studio / Locale se presenti */}
            {installedModels && installedModels.length > 0 && (
              <div className="mt-2.5 border-t border-border/50 pt-2">
                <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                  <span>Modelli Rilevati nel Sistema</span>
                  <span className="font-mono">{installedModels.length}</span>
                </div>
                <div className="max-h-28 overflow-y-auto space-y-1 pr-1">
                  {installedModels.map((item, idx) => (
                    <div
                      key={item.digest || item.name || idx}
                      className="flex items-center justify-between px-2 py-1.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-border/40 text-[11px]"
                    >
                      <div className="flex items-center gap-1.5 min-w-0 truncate">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                        <span className="font-mono truncate font-medium text-foreground">
                          {item.name}
                        </span>
                      </div>
                      <span className="shrink-0 text-[10px] text-muted-foreground font-mono ml-2">
                        {item.sizeFormatted}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Footer con Azione Gestore Modelli */}
            {onOpenManager && (
              <div className="mt-3 border-t border-border/50 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onOpenManager();
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl py-2 text-center text-xs font-bold text-sky-600 hover:bg-sky-500/10 active:scale-95 dark:text-sky-400 transition-all cursor-pointer"
                >
                  <HardDrive className="h-4 w-4" />
                  <span>Apri Gestore Modelli & Download →</span>
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
