"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle(): void {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      // Storage non disponibile: il tema resta valido per la sessione corrente.
    }
  }

  if (!mounted) {
    return <div className="h-11 w-11 min-h-[44px] min-w-[44px] rounded-full" aria-hidden="true" />;
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="glass-pill h-11 w-11 min-h-[44px] min-w-[44px] rounded-full text-muted-foreground hover:text-foreground active:scale-90 transition-all cursor-pointer shadow-sm"
      onClick={toggle}
      aria-pressed={dark}
      aria-label={dark ? "Attiva il tema chiaro" : "Attiva il tema scuro"}
    >
      {dark ? (
        <Sun className="h-4 w-4 text-amber-400 transition-transform duration-300 hover:rotate-45" />
      ) : (
        <Moon className="h-4 w-4 text-sky-500 transition-transform duration-300 hover:-rotate-12" />
      )}
    </Button>
  );
}
