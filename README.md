# Quartu AI

Chat AI con interfaccia liquid glass che usa esclusivamente un modello LLM in
esecuzione su un server di inferenza che ospiti tu (LM Studio, llama.cpp, vLLM,
endpoint OpenAI-compatible). Nessuna API cloud, nessun SDK proprietario.

## Stack

Next.js 15 (App Router, TypeScript strict) · Tailwind CSS · SQLite + Drizzle ORM · Zod · Vitest

## Modelli

| Versione | Modello | Tag LM Studio | Note |
| --- | --- | --- | --- |
| Base | Ternary Bonsai 1.7B | `MichelRosselli/ternary-bonsai:1.7b-f16` | ~3,4 GB, leggero |
| Pro | Qwen 3.5 4B | `qwen3.5:4b` | ~4–6 GB di memoria consigliati |

```bash
lmstudio pull MichelRosselli/ternary-bonsai:1.7b-f16   # Base
lmstudio pull qwen3.5:4b                               # Pro
```

Il tier scelto nell'interfaccia viene inviato come `"base" | "pro"`: il tag
reale del modello resta configurato solo lato server (`LLM_MODEL_BASE`,
`LLM_MODEL_PRO`). Varianti più capaci della Base: `4b-f16` (~8 GB) e
`8b-f16` (~16 GB), a un cambio di variabile.

## Sviluppo

```bash
npm install
cp .env.example .env.local
lmstudio serve
lmstudio pull MichelRosselli/ternary-bonsai:1.7b-f16
npm run dev        # http://localhost:3000
npm test           # test
npm run typecheck  # controllo tipi
```

## Variabili d'ambiente

| Variabile | Default | Descrizione |
| --- | --- | --- |
| `LLM_BASE_URL` | `http://127.0.0.1:1234/v1` | URL del server OpenAI-compatible |
| `LLM_MODEL_BASE` | `MichelRosselli/ternary-bonsai:1.7b-f16` | Modello Base |
| `LLM_MODEL_PRO` | `qwen3.5:4b` | Modello Pro |
| `LLM_TIMEOUT_MS` | `120000` | Timeout verso il modello (ms) |
| `DATABASE_PATH` | `./data/chat.db` | Percorso SQLite |
| `TRUST_PROXY` | `false` | Leggi l'IP da X-Forwarded-For (solo dietro proxy fidato) |

Le migrazioni Drizzle sono applicate automaticamente all'avvio (idempotenti).
Manualmente: `npm run db:migrate` / `npm run db:generate`.

## Deploy Docker

```bash
# Certificati TLS in docker/certs/ (fullchain.pem, privkey.pem) — mai nel repo.
docker compose build
docker compose up -d
docker compose exec lmstudio lmstudio pull MichelRosselli/ternary-bonsai:1.7b-f16
docker compose exec lmstudio lmstudio pull qwen3.5:4b
```

Sicurezza dello stack: LM Studio non pubblica porte sull'host; il browser parla
solo con `/api/chat`; nginx termina TLS, disabilita il buffering SSE e
sovrascrive `X-Forwarded-For` (da cui `TRUST_PROXY=true` nel container web).

## Smoke test dei modelli

```bash
curl -fsS http://127.0.0.1:1234/v1/models
curl -N http://127.0.0.1:1234/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{"model":"MichelRosselli/ternary-bonsai:1.7b-f16","messages":[{"role":"user","content":"Rispondi solo con OK"}],"stream":true,"max_tokens":16}'
```

## Limiti noti

- Rate limiter in memoria (20 req / 5 min per IP): con più repliche servono
  contatori condivisi (Redis); un riavvio azzera lo stato.
- Nessuna autenticazione: tutte le conversazioni sono globali. La colonna
  `user_id` è già predisposta per filtrare per utente.
- L'anteprima codice (iframe `sandbox="allow-scripts"`) non carica risorse
  esterne per via della CSP, e uno script generato può consumare CPU finché
  l'anteprima resta aperta.
- La privacy ("nessun cloud") vale solo se `LLM_BASE_URL` punta a un server
  sotto il tuo controllo.

## Troubleshooting

- **502 non raggiungibile** — LM Studio spento o `LLM_BASE_URL` errato
  (in Docker deve essere `http://lmstudio:1234/v1`).
- **502 risposta non valida** — tag modello non scaricato: `lmstudio list`,
  poi `lmstudio pull <tag>`.
- **Stream bufferizzato** — verificare `proxy_buffering off;` su `/api/chat`.
- **429** — rate limit: attendere il valore dell'header `Retry-After`.
