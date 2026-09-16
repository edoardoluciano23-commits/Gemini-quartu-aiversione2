"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, MessageSquareCode, Lightbulb, Compass, ShieldCheck } from "lucide-react";
import { MessageItem } from "@/components/chat/message-item";
import type { UiMessage } from "@/lib/types";

interface MessageListProps {
  messages: UiMessage[];
  isStreaming: boolean;
  isLoading: boolean;
  suggestions: readonly string[];
  onSuggestion: (text: string) => void;
}

const SUGGESTION_ICONS = [MessageSquareCode, Lightbulb, Compass, ShieldCheck];

export function MessageList({
  messages,
  isStreaming,
  isLoading,
  suggestions,
  onSuggestion,
}: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);
  const [showJump, setShowJump] = useState(false);

  function handleScroll(): void {
    const el = containerRef.current;
    if (el === null) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 96;
    nearBottomRef.current = nearBottom;
    setShowJump(!nearBottom);
  }

  useEffect(() => {
    const el = containerRef.current;
    if (el !== null && nearBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  function jumpToBottom(): void {
    const el = containerRef.current;
    if (el !== null) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }

  if (messages.length === 0 && !isLoading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 sm:gap-8 px-4 sm:px-6 py-8 text-center animate-in fade-in duration-300">
        <div className="max-w-lg">
          {/* Badge Icona Liquid Glass */}
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl glass-island text-sky-500 shadow-xl shadow-sky-500/10">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white shadow-md shadow-sky-500/30">
              <ShieldCheck className="h-6 w-6" />
            </div>
          </div>

          <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-foreground">
            Ciao, sono <span className="brand-gradient">Quartu AI</span>
          </h2>
          <p className="mt-2.5 text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">
            Motore locale <span className="font-semibold text-foreground">Tri-Engine</span> a zero latenza. I tuoi prompt e i tuoi dati non lasciano mai il tuo dispositivo.
          </p>

          {/* Badge di stato dell'architettura hardware */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
            <span className="glass-pill inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              WebGPU Accelerato
            </span>
            <span className="glass-pill inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold text-sky-600 dark:text-sky-400">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
              LM Studio Bridge
            </span>
            <span className="glass-pill inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
              Quartu Core
            </span>
          </div>
        </div>

        <ul className="grid w-full max-w-xl grid-cols-1 sm:grid-cols-2 gap-3" aria-label="Suggerimenti iniziali">
          {suggestions.map((suggestion, idx) => {
            const Icon = SUGGESTION_ICONS[idx % SUGGESTION_ICONS.length] ?? MessageSquareCode;
            return (
              <li key={suggestion}>
                <button
                  type="button"
                  onClick={() => onSuggestion(suggestion)}
                  className="glass-card group flex h-full w-full items-start gap-3 rounded-2xl p-4 text-left text-xs font-medium text-foreground transition-all duration-200 hover:-translate-y-1 hover:border-sky-500/50 hover:shadow-xl hover:shadow-sky-500/10 active:scale-[0.98] cursor-pointer"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 text-sky-500 group-hover:bg-sky-500 group-hover:text-white transition-colors mt-0.5">
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="leading-snug text-muted-foreground group-hover:text-foreground transition-colors font-medium">
                    {suggestion}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        role="log"
        aria-label="Messaggi della conversazione"
        aria-busy={isStreaming || isLoading}
        className="flex-1 overflow-y-auto px-4 py-4"
      >
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
            <p className="text-xs text-muted-foreground">Caricamento conversazione…</p>
          </div>
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-4">
            {messages.map((message, index) => (
              <MessageItem
                key={message.id}
                message={message}
                isStreamingThis={
                  isStreaming && index === messages.length - 1 && message.role === "assistant"
                }
              />
            ))}
          </div>
        )}
      </div>
      {showJump && (
        <button
          type="button"
          onClick={jumpToBottom}
          aria-label="Torna all'ultimo messaggio"
          className="glass-card absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full p-2.5 shadow-xl transition-all hover:scale-105 hover:bg-white dark:hover:bg-zinc-800"
        >
          <ArrowDown className="h-4 w-4 text-sky-500" />
        </button>
      )}
    </div>
  );
}
