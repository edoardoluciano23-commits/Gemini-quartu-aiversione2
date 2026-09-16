import { spawn } from "child_process";
import { existsSync } from "fs";

function findOllamaBinary(): string | null {
  const possiblePaths = [
    "/usr/local/bin/ollama",
    "/app/applet/bin/ollama",
    "/usr/bin/ollama",
    "./bin/ollama",
  ];
  for (const p of possiblePaths) {
    if (existsSync(p)) return p;
  }
  return null;
}

export async function ensureOllamaRunning(hostUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${hostUrl}/v1/models`, { signal: AbortSignal.timeout(1500) });
    if (res.ok) return true;
  } catch {
    // Non risponde
  }
  return false;
}
