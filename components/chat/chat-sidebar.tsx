"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2, X, MessageSquare, Check, Cloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ConversationDto } from "@/lib/types";

interface ChatSidebarProps {
  conversations: ConversationDto[];
  activeId: string | null;
  open: boolean;
  isStreaming: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onCloseMobile?: () => void;
}

export function ChatSidebar({
  conversations,
  activeId,
  open,
  isStreaming,
  onSelect,
  onNew,
  onRename,
  onDelete,
  onCloseMobile,
}: ChatSidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  function commitRename(id: string): void {
    const title = draftTitle.trim();
    setEditingId(null);
    if (title.length > 0) onRename(id, title);
  }

  if (!open) return null;

  return (
    <>
      {/* Mobile backdrop overlay con blur satinato */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-md transition-opacity md:hidden"
        onClick={onCloseMobile}
        aria-hidden="true"
      />

      <aside
        aria-label="Cronologia conversazioni"
        className="glass-island fixed inset-y-0 left-0 z-50 flex w-80 max-w-[85vw] shrink-0 flex-col shadow-2xl transition-all md:static md:my-3 md:ml-4 md:rounded-3xl md:h-[calc(100dvh-1.5rem)]"
      >
        {/* Header della Sidebar con safe-area per iPhone */}
        <div className="flex items-center justify-between px-4 pb-2 pt-[calc(1rem+env(safe-area-inset-top))] md:pt-4 border-b border-border/30">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-gradient-to-tr from-sky-500 via-indigo-600 to-blue-600 text-white shadow-md shadow-sky-500/30">
              <MessageSquare className="h-4 w-4" />
            </div>
            <div>
              <p className="brand-gradient text-base font-extrabold tracking-tight">Quartu AI</p>
              <p className="text-[10px] font-mono text-muted-foreground/70 -mt-0.5">Tri-Engine Core</p>
            </div>
          </div>

          {onCloseMobile && (
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11 min-h-[44px] min-w-[44px] rounded-2xl text-muted-foreground hover:text-foreground md:hidden active:scale-95 transition-all"
              onClick={onCloseMobile}
              aria-label="Chiudi barra laterale"
            >
              <X className="h-5 w-5" />
            </Button>
          )}
        </div>

        {/* Pulsante Nuova Chat Cristallino */}
        <div className="p-3">
          <button
            type="button"
            onClick={() => {
              onNew();
              onCloseMobile?.();
            }}
            disabled={isStreaming}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 via-indigo-600 to-blue-600 px-4 py-3 text-xs sm:text-sm font-bold text-white shadow-md shadow-sky-500/25 hover:shadow-lg hover:shadow-sky-500/35 hover:brightness-105 active:scale-95 transition-all disabled:opacity-40 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>+ Nuova Conversazione</span>
          </button>
        </div>

        {/* Elenco Conversazioni */}
        <nav className="flex-1 overflow-y-auto px-2 pb-3" aria-label="Elenco conversazioni">
          {conversations.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              Nessuna chat recente.
            </div>
          ) : (
            <ul className="space-y-1">
              {conversations.map((conversation) => {
                const isActive = activeId === conversation.id;
                const isEditing = editingId === conversation.id;
                const isConfirmingDelete = confirmDeleteId === conversation.id;

                return (
                  <li key={conversation.id}>
                    {isEditing ? (
                      <div className="flex items-center gap-1 p-1">
                        <Input
                          autoFocus
                          value={draftTitle}
                          aria-label={`Nuovo titolo per ${conversation.title}`}
                          maxLength={120}
                          className="h-11 md:h-8 text-sm md:text-xs bg-white/70 dark:bg-zinc-800"
                          onChange={(e) => setDraftTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              commitRename(conversation.id);
                            }
                            if (e.key === "Escape") setEditingId(null);
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => commitRename(conversation.id)}
                          className="flex h-11 w-11 md:h-8 md:w-8 shrink-0 items-center justify-center rounded-lg bg-sky-500 text-white hover:bg-sky-600"
                        >
                          <Check className="h-4 w-4 md:h-3.5 md:w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div
                        className={cn(
                          "group relative flex items-center gap-1.5 rounded-2xl px-3 py-2 text-sm md:text-xs transition-all",
                          isActive
                            ? "glass-pill font-bold text-foreground border-sky-500/40 shadow-sm bg-white/80 dark:bg-zinc-800/80"
                            : "text-muted-foreground hover:bg-white/60 hover:text-foreground dark:hover:bg-zinc-800/50 hover:border hover:border-white/20 dark:hover:border-white/5",
                        )}
                      >
                        {isActive && (
                          <span className="h-2 w-2 rounded-full bg-sky-500 shrink-0 shadow-sm shadow-sky-500" />
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            onSelect(conversation.id);
                            onCloseMobile?.();
                          }}
                          disabled={isStreaming}
                          aria-current={isActive ? "true" : undefined}
                          className="min-h-[44px] md:min-h-0 min-w-0 flex-1 truncate text-left focus-visible:outline-none font-medium cursor-pointer"
                        >
                          {conversation.title}
                        </button>

                        {/* Azioni Rinomina ed Elimina */}
                        {isConfirmingDelete ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                onDelete(conversation.id);
                                setConfirmDeleteId(null);
                              }}
                              className="rounded-md h-11 md:h-auto min-w-[44px] bg-destructive px-2 md:px-1.5 py-1 md:py-0.5 text-xs md:text-[10px] font-bold text-white hover:bg-destructive/90"
                            >
                              Sì, elimina
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="rounded-md h-11 md:h-auto min-w-[44px] bg-muted px-2 md:px-1.5 py-1 md:py-0.5 text-xs md:text-[10px] font-medium hover:bg-muted/80"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-0.5 opacity-80 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              aria-label={`Rinomina ${conversation.title}`}
                              className="rounded-lg h-11 w-11 md:h-auto md:w-auto p-2 md:p-1 hover:bg-muted hover:text-foreground flex items-center justify-center"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingId(conversation.id);
                                setDraftTitle(conversation.title);
                              }}
                            >
                              <Pencil className="h-4 w-4 md:h-3 md:w-3" />
                            </button>
                            <button
                              type="button"
                              aria-label={`Elimina ${conversation.title}`}
                              disabled={isStreaming && isActive}
                              className="rounded-lg h-11 w-11 md:h-auto md:w-auto p-2 md:p-1 hover:bg-destructive/10 hover:text-destructive flex items-center justify-center"
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmDeleteId(conversation.id);
                              }}
                            >
                              <Trash2 className="h-4 w-4 md:h-3 md:w-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </nav>

        {/* Footer Firebase Cloud Sync */}
        <div className="border-t border-border/40 p-3 text-[11px] text-muted-foreground flex items-center justify-between">
          <span className="flex items-center gap-1.5 font-medium text-sky-600 dark:text-sky-400">
            <Cloud className="h-3.5 w-3.5" />
            <span>Firebase Cloud Sync</span>
          </span>
          <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
            Attivo
          </span>
        </div>
      </aside>
    </>
  );
}
