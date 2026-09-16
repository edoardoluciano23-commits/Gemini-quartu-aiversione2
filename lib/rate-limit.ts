// Token bucket in memoria: 20 richieste ogni 5 minuti per chiave.
// Limite noto: lo stato vive nel processo Node, quindi con più repliche ogni
// istanza ha il proprio bucket. Per deployment multi-replica usare Redis.
const CAPACITY = 20;
const WINDOW_MS = 5 * 60_000;
const REFILL_PER_MS = CAPACITY / WINDOW_MS;
const MAX_BUCKETS = 10_000;

interface Bucket {
  tokens: number;
  last: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
  remaining: number;
}

function prune(now: number): void {
  if (buckets.size < MAX_BUCKETS) return;
  for (const [key, bucket] of buckets) {
    if (now - bucket.last > WINDOW_MS) buckets.delete(key);
  }
}

export function consumeToken(key: string, now: number = Date.now()): RateLimitResult {
  prune(now);
  const bucket = buckets.get(key) ?? { tokens: CAPACITY, last: now };
  const elapsed = Math.max(0, now - bucket.last);
  bucket.tokens = Math.min(CAPACITY, bucket.tokens + elapsed * REFILL_PER_MS);
  bucket.last = now;
  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    buckets.set(key, bucket);
    return { allowed: true, retryAfterSeconds: 0, remaining: Math.floor(bucket.tokens) };
  }
  buckets.set(key, bucket);
  return {
    allowed: false,
    retryAfterSeconds: Math.ceil((1 - bucket.tokens) / REFILL_PER_MS / 1000),
    remaining: 0,
  };
}

export function resetRateLimiter(): void {
  buckets.clear();
}

// L'IP viene letto da X-Forwarded-For SOLO se TRUST_PROXY=true, perché quel
// header è affidabile soltanto quando un reverse proxy fidato lo sovrascrive
// (come fa l'nginx di questo repo). In sviluppo locale si usa una chiave unica
// condivisa: tutte le richieste attingono allo stesso bucket.
export function getClientIp(headers: Headers): string {
  if (process.env.TRUST_PROXY === "true") {
    const forwarded = headers.get("x-forwarded-for");
    const first = forwarded?.split(",")[0]?.trim();
    if (first !== undefined && first.length > 0) return first;
  }
  return "local";
}
