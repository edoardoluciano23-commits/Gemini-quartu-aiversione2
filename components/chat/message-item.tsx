"use client";

import * as React from "react";
import { useRef, useState } from "react";
import { Copy, Check, Eye, EyeOff, RotateCcw, Bot, User, Terminal } from "lucide-react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import type { UiMessage } from "@/lib/types";

const timeFormatter = new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit" });

// Linguaggi renderizzabili nell'anteprima sandbox.
const PREVIEWABLE = new Set(["html", "svg", "xml", "css", "js", "javascript"]);

function extractLanguage(children: React.ReactNode): string | null {
  const child = Array.isArray(children) ? children[0] : children;
  if (React.isValidElement(child)) {
    const className = (child.props as { className?: string }).className ?? "";
    const match = /language-([\w+-]+)/.exec(className);
    return match?.[1]?.toLowerCase() ?? null;
  }
  return null;
}

function buildSrcDoc(lang: string, code: string): string {
  const isDark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");
  const bg = isDark ? "#090d16" : "#ffffff";
  const fg = isDark ? "#f1f5f9" : "#0f172a";

  const baseHead = `
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      body {
        margin: 0;
        padding: 16px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        background-color: ${bg};
        color: ${fg};
        overflow-x: hidden;
      }
      * { box-sizing: border-box; }
    </style>
  `;

  if (lang === "css") {
    return `<!doctype html><html><head>${baseHead}<style>${code}</style></head><body><h1>Titolo Demo</h1><p>Esempio di anteprima per gli stili CSS applicati.</p><button style="padding:8px 16px;border-radius:8px;border:1px solid currentColor;background:transparent;color:inherit;cursor:pointer;">Pulsante Demo</button></body></html>`;
  }

  if (lang === "js" || lang === "javascript") {
    const safe = code.replace(/<\/script/gi, "<\\/script");
    return (
      `<!doctype html><html><head>${baseHead}</head><body>` +
      `<div style="font-size:12px;font-weight:600;opacity:0.6;margin-bottom:8px">CONSOLE OUTPUT:</div>` +
      `<pre id="out" style="font:13px/1.5 ui-monospace,monospace;white-space:pre-wrap;padding:12px;border-radius:8px;background:${isDark ? "#1e293b" : "#f1f5f9"};border:1px solid ${isDark ? "#334155" : "#e2e8f0"}"></pre>` +
      `<script>var el=document.getElementById("out");function p(){var a=[].slice.call(arguments);el.textContent+=a.map(function(v){try{return typeof v==="object"?JSON.stringify(v,null,2):String(v)}catch(e){return String(v)}}).join(" ")+"\\n"}console.log=p;console.warn=p;console.error=p;window.onerror=function(m){p("Errore:",m)};</script>` +
      `<script>${safe}</script></body></html>`
    );
  }

  // Per HTML o SVG inserisci il viewport e il reset base
  if (code.includes("<html") || code.includes("<!DOCTYPE") || code.includes("<!doctype")) {
    return code;
  }

  return `<!doctype html><html><head>${baseHead}</head><body>${code}</body></html>`;
}

function CodeBlock({
  node: _node,
  children,
  ...props
}: React.ComponentProps<"pre"> & { node?: unknown }) {
  const preRef = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<string | null>(null);
  const [iframeKey, setIframeKey] = useState(0);
  const lang = extractLanguage(children);
  const canPreview = lang !== null && PREVIEWABLE.has(lang);

  async function copy(): Promise<void> {
    const text = preRef.current?.innerText ?? "";
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard non disponibile
    }
  }

  function togglePreview(): void {
    if (previewDoc !== null) {
      setPreviewDoc(null);
      return;
    }
    const code = preRef.current?.innerText ?? "";
    if (lang !== null && code.trim().length > 0) {
      setPreviewDoc(buildSrcDoc(lang, code));
    }
  }

  function reloadPreview(): void {
    const code = preRef.current?.innerText ?? "";
    if (lang !== null && code.trim().length > 0) {
      setPreviewDoc(buildSrcDoc(lang, code));
      setIframeKey((k) => k + 1);
    }
  }

  return (
    <div className="group relative my-3.5 overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-950/95 shadow-2xl backdrop-blur-xl ring-1 ring-white/10">
      {/* Header macOS Style del blocco di codice */}
      <div className="flex items-center justify-between border-b border-zinc-800/80 bg-zinc-900/90 px-4 py-2.5 text-xs text-zinc-400 backdrop-blur-md">
        <div className="flex items-center gap-3">
          {/* Tre puntini stile finestra macOS */}
          <div className="flex items-center gap-1.5" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f56]/90 shadow-sm" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]/90 shadow-sm" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#27c93f]/90 shadow-sm" />
          </div>
          <div className="flex items-center gap-1.5 pl-1 border-l border-zinc-700/50">
            <Terminal className="h-3.5 w-3.5 text-sky-400" />
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-zinc-300">
              {lang || "code"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {canPreview && (
            <button
              type="button"
              onClick={togglePreview}
              aria-label={previewDoc !== null ? "Chiudi anteprima live" : "Mostra anteprima live"}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all active:scale-95 cursor-pointer",
                previewDoc !== null
                  ? "bg-sky-500/25 text-sky-300 border border-sky-500/40 shadow-sm"
                  : "bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700/90 border border-zinc-700/60",
              )}
            >
              {previewDoc !== null ? (
                <>
                  <EyeOff className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Chiudi Anteprima</span>
                </>
              ) : (
                <>
                  <Eye className="h-3.5 w-3.5 text-sky-400" /> <span className="hidden sm:inline">Anteprima Live</span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={() => void copy()}
            aria-label="Copia il codice negli appunti"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-zinc-800/80 border border-zinc-700/60 px-2.5 py-1 text-xs font-medium text-zinc-300 transition-all hover:bg-zinc-700/90 active:scale-95 cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-emerald-400 hidden sm:inline">Copiato</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Copia</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Contenuto del codice */}
      <pre ref={preRef} className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed text-zinc-100 selection:bg-sky-500/30" {...props}>
        {children}
      </pre>

      {/* Finestra di Anteprima Iframe Sandbox */}
      {previewDoc !== null && (
        <div className="border-t border-zinc-800 bg-zinc-900/70 p-3">
          <div className="mb-2 flex items-center justify-between px-2 text-[11px] text-zinc-400">
            <span className="font-semibold text-zinc-300">Anteprima Esecuzione Sandbox</span>
            <button
              type="button"
              onClick={reloadPreview}
              className="inline-flex items-center gap-1 text-zinc-400 hover:text-zinc-200 transition-colors"
              title="Ricarica anteprima"
            >
              <RotateCcw className="h-3 w-3" /> Ricarica
            </button>
          </div>
          <iframe
            key={iframeKey}
            title={`Anteprima ${lang ?? ""}`}
            sandbox="allow-scripts"
            srcDoc={previewDoc}
            className="h-80 w-full rounded-xl border border-zinc-700/60 bg-white dark:bg-zinc-950 shadow-inner"
          />
        </div>
      )}
    </div>
  );
}

function ExternalLink({
  node: _node,
  ...props
}: React.ComponentProps<"a"> & { node?: unknown }) {
  return <a {...props} target="_blank" rel="noopener noreferrer nofollow" />;
}

interface MessageItemProps {
  message: UiMessage;
  isStreamingThis: boolean;
}

export function MessageItem({ message, isStreamingThis }: MessageItemProps) {
  const isUser = message.role === "user";
  const [copiedMessage, setCopiedMessage] = useState(false);

  async function copyMessage(): Promise<void> {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopiedMessage(true);
      window.setTimeout(() => setCopiedMessage(false), 2000);
    } catch {
      // Clipboard non disponibile
    }
  }

  return (
    <article
      aria-label={isUser ? "Messaggio inviato da te" : "Risposta di Quartu AI"}
      className={cn(
        "group relative flex flex-col gap-1.5 transition-all",
        isUser ? "items-end" : "items-start",
      )}
    >
      {/* Intestazione mittente e orario */}
      <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground/80">
        <div
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-xl text-[11px] font-semibold transition-all",
            isUser
              ? "bg-gradient-to-tr from-sky-500 to-indigo-600 text-white shadow-sm ring-2 ring-sky-500/20"
              : "glass-pill text-sky-500 border border-sky-500/30 shadow-sm ring-1 ring-sky-500/20",
          )}
        >
          {isUser ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
        </div>
        <span className="font-bold text-foreground/90 tracking-tight">{isUser ? "Tu" : "Quartu AI"}</span>
        <time dateTime={new Date(message.createdAt).toISOString()} className="text-[11px] opacity-70 font-mono">
          {timeFormatter.format(new Date(message.createdAt))}
        </time>

        {message.status === "incomplete" && (
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400 border border-amber-500/30">
            Incompleta
          </span>
        )}

        {!isUser && !isStreamingThis && message.content.length > 0 && (
          <button
            type="button"
            onClick={() => void copyMessage()}
            aria-label="Copia risposta completa"
            className="ml-2 inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-medium opacity-0 transition-all group-hover:opacity-100 hover:bg-white/80 dark:hover:bg-zinc-800/80 hover:text-foreground focus-visible:opacity-100 cursor-pointer"
          >
            {copiedMessage ? (
              <>
                <Check className="h-3 w-3 text-emerald-500" />
                <span className="text-emerald-500 font-semibold">Copiato</span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                <span>Copia</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Bubble del messaggio */}
      <div
        className={cn(
          "text-sm leading-relaxed transition-all",
          isUser
            ? "glass-bubble-user max-w-[88%] md:max-w-[78%] rounded-3xl rounded-tr-xs px-5 py-3.5 shadow-lg shadow-sky-500/20"
            : "glass-bubble-assistant w-full rounded-3xl rounded-tl-xs px-5 sm:px-6 py-4 shadow-sm",
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap break-words text-white font-normal">{message.content}</p>
        ) : (
          <div className="markdown break-words">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
              components={{ pre: CodeBlock, a: ExternalLink }}
            >
              {message.content}
            </ReactMarkdown>
            {isStreamingThis && (
              <span
                aria-hidden="true"
                className="ml-1 inline-block h-4 w-1.5 animate-pulse rounded-full bg-sky-500 align-middle shadow-sm shadow-sky-500"
              />
            )}
          </div>
        )}
      </div>
    </article>
  );
}
