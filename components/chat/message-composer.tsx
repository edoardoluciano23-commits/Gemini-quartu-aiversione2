"use client";

import { useRef, useState, useEffect } from "react";
import { Send, Square, Sparkles, X, Code2, Zap, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MAX_MESSAGE_LENGTH } from "@/lib/schemas";

interface MessageComposerProps {
  isStreaming: boolean;
  disabled: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
}

const QUICK_PROMPTS = [
  { label: "Scrivi Codice", icon: Code2, prompt: "Scrivi un componente React in TypeScript per " },
  { label: "Spiega Concetto", icon: HelpCircle, prompt: "Spiegami in modo chiaro e conciso come funziona " },
  { label: "Ottimizza", icon: Zap, prompt: "Analizza e ottimizza le prestazioni di " },
];

export function MessageComposer({ isStreaming, disabled, onSend, onStop }: MessageComposerProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Ridimensiona dinamicamente l'altezza in base al contenuto inserito
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    const nextHeight = Math.min(Math.max(textarea.scrollHeight, 44), 180);
    textarea.style.height = `${nextHeight}px`;
  }, [value]);

  function submit(): void {
    const text = value.trim();
    if (text.length === 0 || isStreaming || disabled) return;
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "44px";
    }
    onSend(text);
  }

  return (
    <form
      className="px-3 sm:px-6 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-1"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="glass-island mx-auto flex max-w-3xl flex-col rounded-3xl p-3 shadow-2xl transition-all focus-within:ring-2 focus-within:ring-sky-500/40 focus-within:border-sky-500/40">
        {/* Quick Suggestion Pills quando l'input è vuoto */}
        {value.length === 0 && !isStreaming && (
          <div className="flex items-center gap-1.5 px-1 pb-2 overflow-x-auto no-scrollbar">
            {QUICK_PROMPTS.map((qp) => {
              const Icon = qp.icon;
              return (
                <button
                  key={qp.label}
                  type="button"
                  onClick={() => {
                    setValue(qp.prompt);
                    textareaRef.current?.focus();
                  }}
                  className="glass-pill flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <Icon className="h-3 w-3 text-sky-500" />
                  <span>{qp.label}</span>
                </button>
              );
            })}
          </div>
        )}

        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={value}
            rows={1}
            maxLength={MAX_MESSAGE_LENGTH}
            disabled={disabled}
            placeholder="Chiedi qualcosa a Quartu AI… (Invio per inviare)"
            aria-label="Scrivi un messaggio"
            className="flex-1 resize-none bg-transparent px-3 py-2 text-base md:text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus:outline-none disabled:opacity-50 min-h-[44px] max-h-[180px]"
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
            }}
          />

          {value.length > 0 && !disabled && !isStreaming && (
            <button
              type="button"
              onClick={() => setValue("")}
              title="Cancella testo"
              aria-label="Cancella testo"
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground/60 hover:text-foreground hover:bg-muted/40 transition-colors pb-0.5"
            >
              <X className="h-4 w-4" />
            </button>
          )}

          <div className="flex shrink-0 items-center gap-1.5 pb-0.5 pr-1">
            {isStreaming ? (
              <Button
                type="button"
                variant="outline"
                onClick={onStop}
                aria-label="Interrompi la risposta"
                className="h-11 px-4 gap-1.5 rounded-2xl border-destructive/40 bg-destructive/15 text-destructive hover:bg-destructive/25 text-sm font-semibold shadow-md shadow-destructive/20 min-w-[44px] animate-pulse active:scale-95 transition-all"
              >
                <Square className="h-4 w-4 fill-current" />
                <span className="hidden sm:inline">Interrompi</span>
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={disabled || value.trim().length === 0}
                aria-label="Invia il messaggio"
                className="h-11 w-11 md:w-auto md:px-5 gap-1.5 rounded-2xl bg-gradient-to-r from-sky-500 via-indigo-600 to-blue-600 text-white shadow-md shadow-sky-500/30 hover:shadow-lg hover:shadow-sky-500/40 hover:brightness-105 active:scale-95 disabled:opacity-30 disabled:hover:brightness-100 transition-all font-semibold text-sm min-w-[44px]"
              >
                <Send className="h-4 w-4" />
                <span className="hidden sm:inline">Invia</span>
              </Button>
            )}
          </div>
        </div>

        {/* Barra di stato inferiore discreta */}
        <div className="flex items-center justify-between px-3 pt-1 text-[11px] text-muted-foreground/70 border-t border-border/30 mt-1">
          <span className="flex items-center gap-1.5 opacity-80">
            <Sparkles className="h-3 w-3 text-sky-500" />
            <span className="hidden xs:inline">Elaborazione locale attiva</span>
            <span className="xs:hidden">Locale</span>
            <span className="opacity-50">•</span>
            <span>Tri-Engine Failover</span>
          </span>
          {value.length > 0 && (
            <span className="font-mono text-[10px] opacity-70">
              {value.length}/{MAX_MESSAGE_LENGTH}
            </span>
          )}
        </div>
      </div>
    </form>
  );
}
