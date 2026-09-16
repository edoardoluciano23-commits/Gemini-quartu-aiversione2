import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function jsonError(status: number, message: string): Response {
  return Response.json({ error: message }, { status });
}

export type JsonBodyResult =
  | { ok: true; value: unknown }
  | { ok: false; status: number; message: string };

export async function readJsonBody(req: Request, maxChars: number): Promise<JsonBodyResult> {
  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return { ok: false, status: 400, message: "Richiesta non leggibile." };
  }
  if (raw.length > maxChars) {
    return { ok: false, status: 413, message: "Richiesta troppo grande." };
  }
  if (raw.trim() === "") return { ok: true, value: {} };
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    return { ok: false, status: 400, message: "JSON non valido." };
  }
}
