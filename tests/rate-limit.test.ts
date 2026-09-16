import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { consumeToken, getClientIp, resetRateLimiter } from "@/lib/rate-limit";

describe("consumeToken", () => {
  beforeEach(() => resetRateLimiter());

  it("consente 20 richieste e blocca la ventunesima", () => {
    const now = 1_000_000;
    for (let i = 0; i < 20; i += 1) {
      expect(consumeToken("ip-a", now).allowed).toBe(true);
    }
    const blocked = consumeToken("ip-a", now);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("ricarica i token con il passare del tempo", () => {
    const now = 1_000_000;
    for (let i = 0; i < 20; i += 1) consumeToken("ip-b", now);
    expect(consumeToken("ip-b", now).allowed).toBe(false);
    // Dopo 5 minuti il bucket è di nuovo pieno.
    expect(consumeToken("ip-b", now + 5 * 60_000).allowed).toBe(true);
  });

  it("mantiene bucket indipendenti per chiavi diverse", () => {
    const now = 1_000_000;
    for (let i = 0; i < 20; i += 1) consumeToken("ip-c", now);
    expect(consumeToken("ip-c", now).allowed).toBe(false);
    expect(consumeToken("ip-d", now).allowed).toBe(true);
  });
});

describe("getClientIp", () => {
  const original = process.env.TRUST_PROXY;

  afterEach(() => {
    if (original === undefined) delete process.env.TRUST_PROXY;
    else process.env.TRUST_PROXY = original;
  });

  it("ignora X-Forwarded-For senza TRUST_PROXY", () => {
    delete process.env.TRUST_PROXY;
    const headers = new Headers({ "x-forwarded-for": "1.2.3.4" });
    expect(getClientIp(headers)).toBe("local");
  });

  it("usa il primo IP di X-Forwarded-For con TRUST_PROXY=true", () => {
    process.env.TRUST_PROXY = "true";
    const headers = new Headers({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" });
    expect(getClientIp(headers)).toBe("1.2.3.4");
  });
});
