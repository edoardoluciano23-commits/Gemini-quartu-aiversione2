"use client";

import { useState } from "react";
import { Cloud, LogIn, LogOut, User as UserIcon, CheckCircle, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFirebaseAuth } from "@/components/auth/firebase-auth-provider";
import firebaseConfig from "@/firebase-applet-config.json";

export function AuthButton() {
  const { user, loading, signInWithGoogle, signOutUser, error } = useFirebaseAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);

  if (loading) {
    return (
      <div className="flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-muted/40 animate-pulse" />
    );
  }

  if (!user) {
    return (
      <div className="relative">
        <Button
          variant="outline"
          disabled={isSigningIn}
          onClick={async () => {
            setIsSigningIn(true);
            try {
              await signInWithGoogle();
            } catch {
              // gestito nel provider
            } finally {
              setIsSigningIn(false);
            }
          }}
          className="glass-pill h-11 min-h-[44px] min-w-[44px] gap-2 rounded-full border-sky-500/30 bg-sky-500/10 px-3.5 md:px-4 text-xs sm:text-sm font-bold text-sky-600 hover:bg-sky-500/20 active:scale-95 dark:text-sky-400 cursor-pointer shadow-sm transition-all"
          title="Accedi con Google per sincronizzare le chat su Firebase Cloud"
        >
          <LogIn className="h-4 w-4" />
          <span className="hidden sm:inline">Accedi (Cloud)</span>
        </Button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Button
        variant="ghost"
        onClick={() => setIsOpen((prev) => !prev)}
        className="glass-pill h-11 min-h-[44px] min-w-[44px] gap-2 rounded-full bg-emerald-500/10 px-3 md:px-3.5 text-xs sm:text-sm font-bold text-emerald-600 hover:bg-emerald-500/20 active:scale-95 dark:text-emerald-400 cursor-pointer shadow-sm transition-all border-emerald-500/30"
        title="Connesso a Firebase Firestore"
      >
        {user.photoURL ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.photoURL}
            alt={user.displayName ?? "User"}
            className="h-6 w-6 rounded-full ring-2 ring-emerald-500/40"
          />
        ) : (
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-bold">
            {user.displayName ? user.displayName.charAt(0).toUpperCase() : <UserIcon className="h-4 w-4" />}
          </div>
        )}
        <span className="hidden sm:inline max-w-[100px] truncate font-bold">
          {user.displayName?.split(" ")[0] ?? "Account"}
        </span>
        <Cloud className="h-4 w-4 text-emerald-500" />
      </Button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-xs"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          <div className="glass-island absolute right-0 top-13 z-50 w-76 rounded-3xl p-4 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-150">
            <div className="flex items-center gap-3 pb-3 border-b border-border/40">
              {user.photoURL ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.photoURL}
                  alt={user.displayName ?? "User"}
                  className="h-10 w-10 rounded-2xl ring-2 ring-emerald-500/40 shadow-sm"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-600 font-extrabold text-sm">
                  {user.displayName ? user.displayName.charAt(0).toUpperCase() : <UserIcon className="h-5 w-5" />}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold truncate text-foreground">
                  {user.displayName ?? "Utente Firebase"}
                </p>
                <p className="text-[11px] text-muted-foreground truncate font-mono">
                  {user.email}
                </p>
              </div>
            </div>

            <div className="my-3 space-y-1.5 rounded-2xl bg-muted/40 p-3 text-[11px] text-muted-foreground border border-border/30">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                  <CheckCircle className="h-3.5 w-3.5" /> Firebase Firestore
                </span>
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-300">
                  Online
                </span>
              </div>
              <div className="flex items-center gap-1 pt-1 text-[10px] text-muted-foreground truncate font-mono">
                <Database className="h-3 w-3 shrink-0 text-sky-500" />
                <span className="truncate">DB: {firebaseConfig.firestoreDatabaseId}</span>
              </div>
              <div className="text-[10px] text-muted-foreground truncate font-mono opacity-80">
                Progetto: {firebaseConfig.projectId}
              </div>
            </div>

            {error && (
              <p className="text-[11px] text-destructive mb-2 font-medium">{error}</p>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                setIsOpen(false);
                await signOutUser();
              }}
              className="w-full gap-2 rounded-2xl text-xs font-bold text-destructive hover:bg-destructive/15 hover:text-destructive border-destructive/30 active:scale-95 transition-all"
            >
              <LogOut className="h-3.5 w-3.5" />
              Disconnetti
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
