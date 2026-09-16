// Importabile dal client: solo metadati di UI, nessun tag interno di modello.
export type ModelTier = "free" | "pro" | "ultra";

export interface ModelTierInfo {
  id: ModelTier;
  name: string;
  modelLabel: string;
  description: string;
  requirement: string;
  isMandatory?: boolean;
}

export const DEFAULT_TIER: ModelTier = "free";

export interface ModelItem {
  name: string;
  model: string;
  size: number;
  sizeFormatted: string;
  digest: string;
  modifiedAt?: string;
  tier?: ModelTier;
}

export const MODEL_TIERS: readonly ModelTierInfo[] = [
  {
    id: "free",
    name: "Quartu AI Free",
    modelLabel: "IBM Granite 4.0 H (350M)",
    description: "Ultraleggero e fulmineo (~360 MB): modello compatto nativo per chat e tool.",
    requirement: "Richiede circa 500 MB di RAM. Installazione obbligatoria all'avvio.",
    isMandatory: true,
  },
  {
    id: "pro",
    name: "Quartu AI Pro",
    modelLabel: "Ternary Bonsai 1.7B",
    description: "Veloce e bilanciata (~3,4 GB): ottima per l'uso quotidiano su hardware modesto.",
    requirement: "Richiede circa 4 GB di memoria libera.",
  },
  {
    id: "ultra",
    name: "Quartu AI Ultra",
    modelLabel: "Qwen 2.5 3B",
    description: "Più capace ed evoluto: risposte superiori su codice, logica e testi complessi.",
    requirement: "Richiede circa 4–6 GB di memoria libera.",
  },
] as const;
