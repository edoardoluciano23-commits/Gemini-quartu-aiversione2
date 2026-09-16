"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Menu, RefreshCw, AlertTriangle, ShieldCheck, Activity, HardDrive } from "lucide-react";
import { ChatSidebar } from "@/components/chat/chat-sidebar";
import { MessageComposer } from "@/components/chat/message-composer";
import { MessageList } from "@/components/chat/message-list";
import { ModelPicker } from "@/components/chat/model-picker";
import { ModelManager, type LMStudioStatusData } from "@/components/chat/model-manager";
import { MandatoryModelInstaller } from "@/components/chat/mandatory-model-installer";
import { SYSTEM_PROMPT } from "@/lib/prompts";
import { SystemLogsViewer } from "@/components/chat/system-logs";
import { ThemeToggle } from "@/components/theme-toggle";
import { FirebaseAuthProvider, useFirebaseAuth } from "@/components/auth/firebase-auth-provider";
import { AuthButton } from "@/components/auth/auth-button";
import { EngineIndicator, type EngineMode } from "@/components/chat/engine-indicator";
import { streamFromLocalOllama } from "@/lib/ollama-client-bridge";
import { webLlmEngine } from "@/lib/web-llm-engine";
import { detectHardware } from "@/lib/hardware-detector";
import { syncConversation, syncMessage, deleteConversationFromFirestore } from "@/lib/firestore-sync";
import { Button } from "@/components/ui/button";
import { DEFAULT_TIER, type ModelTier, type ModelItem } from "@/lib/models";
import { createSseParser, parseDeltaContent, SSE_DONE } from "@/lib/sse";
import { SUGGESTIONS } from "@/lib/suggestions";
import type { ChatRole, ConversationDto, UiMessage } from "@/lib/types";

const CONTEXT_WINDOW = 12;
const JSON_HEADERS = { "content-type": "application/json" } as const;
const MODEL_STORAGE_KEY = "quartu-ai:model";
const ENGINE_MODE_STORAGE_KEY = "quartu-ai:engine-mode";

async function readApiError(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    return typeof data.error === "string" ? data.error : fallback;
  } catch {
    return fallback;
  }
}

interface ChatShellProps {
  initialConversations: ConversationDto[];
}

export function ChatShell({ initialConversations }: ChatShellProps) {
  return (
    <FirebaseAuthProvider>
      <ChatShellContent initialConversations={initialConversations} />
    </FirebaseAuthProvider>
  );
}

function ChatShellContent({ initialConversations }: ChatShellProps) {
  const { user } = useFirebaseAuth();
  const [conversations, setConversations] = useState<ConversationDto[]>(initialConversations);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [tier, setTier] = useState<ModelTier>(DEFAULT_TIER);
  const [modelStatusMap, setModelStatusMap] = useState<{ free: boolean; pro: boolean; ultra: boolean } | undefined>(undefined);
  const [installedModels, setInstalledModels] = useState<ModelItem[]>([]);
  const [isModelManagerOpen, setIsModelManagerOpen] = useState(false);
  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const [engineMode, setEngineMode] = useState<EngineMode>("auto");
  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef<string | null>(null);

  const refreshModels = useCallback(async () => {
    try {
      let customHost: string | undefined;
      try {
        const saved = localStorage.getItem("quartu-ai:lmstudio-host");
        if (saved && saved.trim()) customHost = saved.trim();
      } catch {
        // Storage non disponibile
      }
      const query = customHost ? `?host=${encodeURIComponent(customHost)}` : "";
      const res = await fetch(`/api/models${query}`);
      if (res.ok) {
        const json = (await res.json()) as LMStudioStatusData;
        if (json?.status) {
          setModelStatusMap(json.status);
        }
        if (json?.installed) {
          setInstalledModels(json.installed);
        }
      }
    } catch {
      // Ignora errore
    }
  }, []);

  useEffect(() => {
    void refreshModels();
  }, [refreshModels]);

  const handleModelStatusChange = useCallback((data: LMStudioStatusData | null) => {
    if (data?.status) {
      setModelStatusMap(data.status);
    }
    if (data?.installed) {
      setInstalledModels(data.installed);
    }
  }, []);

  const activeTitle = conversations.find((c) => c.id === activeId)?.title ?? null;

  useEffect(() => {
    try {
      const savedModel = localStorage.getItem(MODEL_STORAGE_KEY);
      if (savedModel === "free" || savedModel === "pro" || savedModel === "ultra") {
        setTier(savedModel);
      }
      const savedEngine = localStorage.getItem(ENGINE_MODE_STORAGE_KEY);
      if (savedEngine === "auto" || savedEngine === "webgpu" || savedEngine === "lmstudio") {
        setEngineMode(savedEngine);
      }
    } catch {
      // Storage non disponibile
    }
  }, []);

  function changeTier(next: ModelTier): void {
    setTier(next);
    try {
      localStorage.setItem(MODEL_STORAGE_KEY, next);
    } catch {
      // Storage non disponibile
    }
  }

  function changeEngineMode(next: EngineMode): void {
    setEngineMode(next);
    try {
      localStorage.setItem(ENGINE_MODE_STORAGE_KEY, next);
    } catch {
      // Storage non disponibile
    }
  }

  function touchConversation(id: string): void {
    setConversations((prev) => {
      const now = Date.now();
      const next = prev.map((c) => (c.id === id ? { ...c, updatedAt: now } : c));
      next.sort((a, b) => b.updatedAt - a.updatedAt);
      return next;
    });
  }

  async function persistMessages(
    conversationId: string,
    toSave: Array<{ role: ChatRole; content: string; status?: "complete" | "incomplete" }>,
    replaceLastAssistant = false,
  ): Promise<void> {
    if (user) {
      for (const m of toSave) {
        void syncMessage(user.uid, conversationId, {
          id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          role: m.role,
          content: m.content,
          status: m.status ?? "complete",
          createdAt: Date.now(),
        });
      }
    }
    try {
      const res = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ messages: toSave, replaceLastAssistant }),
      });
      if (!res.ok) {
        setError("Il messaggio non è stato salvato nella cronologia.");
      }
    } catch {
      setError("Il messaggio non è stato salvato nella cronologia.");
    }
  }

  async function createNewConversationOnServer(firstMessage: string): Promise<ConversationDto> {
    const res = await fetch("/api/conversations", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ title: firstMessage.slice(0, 40) }),
    });
    if (!res.ok) throw new Error(await readApiError(res, "Impossibile creare la conversazione."));
    const data = (await res.json()) as { conversation: ConversationDto };
    if (user) {
      void syncConversation(user.uid, data.conversation);
    }
    return data.conversation;
  }

  async function streamAssistant(
    currentMessages: UiMessage[],
    conversationId: string,
    regenerateTargetId?: string,
  ): Promise<void> {
    const controller = new AbortController();
    abortRef.current = controller;
    setIsStreaming(true);
    setError(null);

    const tempId = regenerateTargetId ?? `assistant-${Date.now()}`;
    const windowSlice = currentMessages.slice(-CONTEXT_WINDOW);
    const payloadMessages = windowSlice.map((m) => ({ role: m.role, content: m.content }));

    let firstToken = true;
    let accumulated = "";

    try {
      const hw = await detectHardware();
      let activeEngine = engineMode;
      if (activeEngine === "auto") {
        if (hw.webGpuSupported) activeEngine = "webgpu";
        else activeEngine = "lmstudio";
      }

      const appendDelta = (delta: string) => {
        accumulated += delta;
        if (firstToken) {
          firstToken = false;
          setMessages((prev) => {
            if (regenerateTargetId !== undefined) {
              return prev.map((m) =>
                m.id === regenerateTargetId
                  ? { ...m, content: accumulated, status: "complete" }
                  : m,
              );
            }
            return [...prev, {
              id: tempId,
              role: "assistant",
              content: accumulated,
              status: "complete",
              createdAt: Date.now(),
            }];
          });
        } else {
          setMessages((prev) =>
            prev.map((m) => (m.id === tempId ? { ...m, content: accumulated } : m)),
          );
        }
      };

      if (activeEngine === "webgpu" && webLlmEngine?.currentTier === tier) {
        // WebGPU / WebLLM in browser
        const stream = webLlmEngine.generateStream(payloadMessages);
        for await (const chunk of stream) {
          if (controller.signal.aborted) break;
          appendDelta(chunk);
        }
      } else {
        // Direct LM Studio / Ollama fetch
        let ollamaModel = "qwen2.5:0.5b";
        if (tier === "pro") ollamaModel = "qwen2.5:1.5b";
        if (tier === "ultra") ollamaModel = "qwen2.5:3b";
        
        const systemPrompt = SYSTEM_PROMPT;
        
        const stream = streamFromLocalOllama(ollamaModel, payloadMessages, systemPrompt);
        for await (const chunk of stream) {
          if (controller.signal.aborted) break;
          appendDelta(chunk);
        }
      }

      touchConversation(conversationId);
      void persistMessages(
        conversationId,
        [{ role: "assistant", content: accumulated, status: "complete" }],
        regenerateTargetId !== undefined,
      );
    } catch (err) {
      if (controller.signal.aborted) {
        if (accumulated.length > 0) {
          setMessages((prev) =>
            prev.map((m) => (m.id === tempId ? { ...m, status: "incomplete" } : m)),
          );
          void persistMessages(
            conversationId,
            [{ role: "assistant", content: accumulated, status: "incomplete" }],
            regenerateTargetId !== undefined,
          );
        }
        return;
      }

      const msg = err instanceof Error ? err.message : "Errore imprevisto durante la generazione.";
      setError(msg);

      if (accumulated.length > 0) {
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...m, status: "incomplete" } : m)),
        );
        void persistMessages(
          conversationId,
          [{ role: "assistant", content: accumulated, status: "incomplete" }],
          regenerateTargetId !== undefined,
        );
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }

  async function handleSend(text: string): Promise<void> {
    if (isStreaming) return;
    setError(null);

    const userMessage: UiMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
      status: "complete",
      createdAt: Date.now(),
    };

    let targetConvId = activeId;

    if (targetConvId === null) {
      try {
        const created = await createNewConversationOnServer(text);
        targetConvId = created.id;
        setActiveId(created.id);
        setConversations((prev) => [created, ...prev]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Impossibile avviare una nuova chat.");
        return;
      }
    }

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    touchConversation(targetConvId);

    void persistMessages(targetConvId, [{ role: "user", content: text }]);
    await streamAssistant(nextMessages, targetConvId);
  }

  function handleStop(): void {
    abortRef.current?.abort();
  }

  async function handleRegenerate(): Promise<void> {
    if (activeId === null || isStreaming) return;
    const last = messages[messages.length - 1];
    if (last === undefined || last.role !== "assistant") return;
    const history = messages.slice(0, -1);
    await streamAssistant(history, activeId, last.id);
  }

  const selectConversation = useCallback(async (id: string): Promise<void> => {
    requestIdRef.current = id;
    setActiveId(id);
    setError(null);
    setIsLoadingMessages(true);
    try {
      const res = await fetch(`/api/conversations/${id}/messages`);
      if (requestIdRef.current !== id) return;
      if (!res.ok) {
        throw new Error(await readApiError(res, "Impossibile caricare la conversazione."));
      }
      const data = (await res.json()) as { messages: UiMessage[] };
      if (requestIdRef.current !== id) return;
      setMessages(data.messages);
    } catch (err) {
      if (requestIdRef.current !== id) return;
      setMessages([]);
      setError(err instanceof Error ? err.message : "Impossibile caricare la conversazione.");
    } finally {
      if (requestIdRef.current === id) setIsLoadingMessages(false);
    }
  }, []);

  function startNewChat(): void {
    if (isStreaming) return;
    requestIdRef.current = null;
    setActiveId(null);
    setMessages([]);
    setError(null);
  }

  async function handleRename(id: string, title: string): Promise<void> {
    try {
      const res = await fetch(`/api/conversations/${id}`, {
        method: "PATCH",
        headers: JSON_HEADERS,
        body: JSON.stringify({ title }),
      });
      if (!res.ok) {
        throw new Error(await readApiError(res, "Impossibile rinominare la conversazione."));
      }
      const data = (await res.json()) as { conversation: ConversationDto };
      setConversations((prev) => prev.map((c) => (c.id === id ? data.conversation : c)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile rinominare la conversazione.");
    }
  }

  async function handleDelete(id: string): Promise<void> {
    if (user) {
      void deleteConversationFromFirestore(user.uid, id);
    }
    try {
      const res = await fetch(`/api/conversations/${id}`, { method: "DELETE" });
      if (!res.ok) {
        throw new Error(await readApiError(res, "Impossibile eliminare la conversazione."));
      }
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeId === id) {
        requestIdRef.current = null;
        setActiveId(null);
        setMessages([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile eliminare la conversazione.");
    }
  }

  const canRegenerate =
    !isStreaming && messages.length > 0 && messages[messages.length - 1]?.role === "assistant";

  return (
    <div className="relative flex h-dvh overflow-hidden bg-gradient-to-br from-sky-50/70 via-slate-50 to-indigo-50/50 text-foreground dark:from-zinc-950 dark:via-zinc-900 dark:to-black selection:bg-sky-500/20">
      {/* Elementi di sfondo luminosi per l'effetto Liquid Glass Ultra-Premium */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[36rem] w-[36rem] rounded-full bg-gradient-to-br from-sky-400/30 to-blue-600/20 blur-[100px] dark:from-sky-500/15 dark:to-indigo-600/15" />
        <div className="absolute -right-32 top-1/4 h-[32rem] w-[32rem] rounded-full bg-gradient-to-tr from-indigo-500/25 to-purple-500/20 blur-[110px] dark:from-indigo-600/15 dark:to-violet-600/15" />
        <div className="absolute -bottom-28 left-1/4 h-[30rem] w-[30rem] rounded-full bg-gradient-to-tr from-teal-400/20 to-sky-400/20 blur-[100px] dark:from-emerald-500/10 dark:to-teal-500/10" />
      </div>

      <ChatSidebar
        conversations={conversations}
        activeId={activeId}
        open={sidebarOpen}
        isStreaming={isStreaming}
        onSelect={(id) => {
          if (window.innerWidth < 768) setSidebarOpen(false);
          void selectConversation(id);
        }}
        onNew={() => {
          if (window.innerWidth < 768) setSidebarOpen(false);
          startNewChat();
        }}
        onRename={(id, title) => void handleRename(id, title)}
        onDelete={(id) => void handleDelete(id)}
        onCloseMobile={() => setSidebarOpen(false)}
      />

      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        {/* Header principale: Floating Glass Island */}
        <header className="glass-island mx-2 sm:mx-6 mt-[calc(0.75rem+env(safe-area-inset-top))] mb-1 flex items-center justify-between gap-1.5 sm:gap-3 rounded-2xl sm:rounded-3xl px-2.5 sm:px-4 py-2 z-50 overflow-visible">
          {/* Sinistra: Menu laterale + Titolo Chat */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0 shrink">
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11 min-h-[44px] min-w-[44px] rounded-2xl text-muted-foreground hover:text-foreground hover:bg-white/60 dark:hover:bg-zinc-800/60 active:scale-95 transition-all cursor-pointer shrink-0"
              onClick={() => setSidebarOpen((v) => !v)}
              aria-expanded={sidebarOpen}
              aria-label={sidebarOpen ? "Chiudi la barra laterale" : "Apri la barra laterale"}
            >
              <Menu className="h-5 w-5" />
            </Button>

            <div className="hidden sm:flex items-center gap-2 min-w-0">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <h1 className="truncate text-xs sm:text-sm font-semibold text-foreground/90 tracking-tight leading-tight max-w-[130px] md:max-w-[200px]">
                {activeTitle ?? "Nuova chat"}
              </h1>
            </div>
          </div>

          {/* Centro: Navigatore Modelli Integrato (Tasti Prev/Next, Segmented Pills e Dropdown Completo) */}
          <div className="flex items-center justify-center shrink-0">
            <ModelPicker
              value={tier}
              disabled={isStreaming}
              statusMap={modelStatusMap}
              installedModels={installedModels}
              onChange={changeTier}
              onOpenManager={() => setIsModelManagerOpen(true)}
            />
          </div>

          {/* Destra: Azioni e Controlli Rapidi (Nessun overflow-x-auto per non tagliare i menu fluttuanti) */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {canRegenerate && (
              <Button
                variant="ghost"
                size="sm"
                className="h-11 min-h-[44px] gap-1.5 rounded-full px-2.5 sm:px-3 text-xs sm:text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-white/60 dark:hover:bg-zinc-800/60 active:scale-95 transition-all cursor-pointer"
                onClick={() => void handleRegenerate()}
                title="Rigenera l'ultima risposta"
              >
                <RefreshCw className="h-4 w-4" />
                <span className="hidden md:inline">Rigenera</span>
              </Button>
            )}

            <EngineIndicator mode={engineMode} onModeChange={changeEngineMode} />

            {/* Pulsante rapido Gestore Modelli con badge installati */}
            <Button
              variant="ghost"
              size="icon"
              className="relative h-11 w-11 min-h-[44px] min-w-[44px] rounded-full text-muted-foreground hover:text-foreground hover:bg-white/60 dark:hover:bg-zinc-800/60 active:scale-95 transition-all cursor-pointer"
              onClick={() => setIsModelManagerOpen(true)}
              title="Apri Gestore Modelli & Download locali"
              aria-label="Apri il gestore modelli"
            >
              <HardDrive className="h-4 w-4" />
              {modelStatusMap && (
                <span
                  className="absolute 1 top-1.5 right-1.5 flex h-2 w-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500"
                  title="Modelli gestiti attivi"
                />
              )}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11 min-h-[44px] min-w-[44px] rounded-full text-muted-foreground hover:text-foreground hover:bg-white/60 dark:hover:bg-zinc-800/60 active:scale-95 transition-all cursor-pointer"
              onClick={() => setIsLogsOpen(true)}
              title="Apri i Log di Sistema"
              aria-label="Apri i Log di Sistema"
            >
              <Activity className="h-4 w-4" />
            </Button>

            <AuthButton />
            <ThemeToggle />
          </div>
        </header>

        {/* Modal Gestore Modelli montato all'esterno dell'header per layout sicuro */}
        <ModelManager
          open={isModelManagerOpen}
          onOpenChange={setIsModelManagerOpen}
          onStatusChange={handleModelStatusChange}
        />

        {/* Avviso modello non scaricato se applicabile */}
        {modelStatusMap && !modelStatusMap[tier] && (
          <div
            id="banner-model-not-installed"
            role="button"
            tabIndex={0}
            onClick={() => setIsModelManagerOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setIsModelManagerOpen(true);
              }
            }}
            className="glass mx-4 mt-2 flex cursor-pointer items-center justify-between rounded-xl border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 transition-colors hover:bg-amber-500/15 dark:text-amber-300 animate-in fade-in duration-200"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span>
                Il modello{" "}
                <strong>
                  {tier === "free" ? "Quartu AI Free" : tier === "pro" ? "Quartu AI Pro" : "Quartu AI Ultra"}
                </strong>{" "}
                non è ancora installato in locale.
              </span>
            </div>
            <span className="text-[11px] font-medium opacity-90 underline">
              Clicca per scaricarlo
            </span>
          </div>
        )}

        {/* Modal Obbligatorio di Onboarding se il modello Free non è installato */}
        {modelStatusMap !== undefined && !modelStatusMap.free && (
          <MandatoryModelInstaller
            onInstalled={() => {
              setModelStatusMap((prev) =>
                prev ? { ...prev, free: true } : { free: true, pro: false, ultra: false }
              );
              setTier("free");
            }}
          />
        )}

        <SystemLogsViewer open={isLogsOpen} onClose={() => setIsLogsOpen(false)} />

        <MessageList
          messages={messages}
          isStreaming={isStreaming}
          isLoading={isLoadingMessages}
          suggestions={SUGGESTIONS}
          onSuggestion={(text) => void handleSend(text)}
        />

        {error !== null && (
          <div
            role="alert"
            className="glass mx-4 mb-2 flex items-center justify-between rounded-2xl border-destructive/40 bg-destructive/10 px-4 py-2.5 text-xs font-medium text-destructive shadow-sm"
          >
            <span>{error}</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[11px] text-destructive hover:bg-destructive/20"
              onClick={() => setError(null)}
            >
              Chiudi
            </Button>
          </div>
        )}

        <MessageComposer
          isStreaming={isStreaming}
          disabled={isLoadingMessages}
          onSend={(text) => void handleSend(text)}
          onStop={handleStop}
        />
      </div>
    </div>
  );
}
