import { afterEach, describe, expect, it, vi } from "vitest";
import { createSseParser, parseDeltaContent, SSE_DONE } from "@/lib/sse";

const encoder = new TextEncoder();

function sseResponse(events: string[], chunkSize = Number.POSITIVE_INFINITY): Response {
  const payload = events.map((event) => `data: ${event}\n\n`).join("");
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      if (!Number.isFinite(chunkSize)) {
        controller.enqueue(encoder.encode(payload));
      } else {
        for (let i = 0; i < payload.length; i += chunkSize) {
          controller.enqueue(encoder.encode(payload.slice(i, i + chunkSize)));
        }
      }
      controller.close();
    },
  });
  return new Response(stream, { status: 200, headers: { "content-type": "text/event-stream" } });
}

function delta(content: string): string {
  return JSON.stringify({ choices: [{ delta: { content } }] });
}

async function loadRoute(): Promise<{ POST: (req: Request) => Promise<Response> }> {
  vi.resetModules();
  const { resetRateLimiter } = await import("@/lib/rate-limit");
  resetRateLimiter();
  return import("@/app/api/chat/route");
}

function chatRequest(body: unknown, signal?: AbortSignal): Request {
  return new Request("http://test.local/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
}

function abortableFetchMock(): typeof fetch {
  return vi.fn(
    (input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
        });
      }),
  ) as unknown as typeof fetch;
}

const validBody = { messages: [{ role: "user", content: "Ciao" }] };

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.LLM_TIMEOUT_MS;
});

describe("POST /api/chat", () => {
  it("inoltra lo stream SSE con i parametri fissati dal server", async () => {
    const fetchMock = vi.fn(async () => sseResponse([delta("Ci"), delta("ao"), SSE_DONE]));
    vi.stubGlobal("fetch", fetchMock);
    const { POST } = await loadRoute();

    const res = await POST(chatRequest(validBody));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    expect(res.headers.get("cache-control")).toContain("no-cache");
    const text = await res.text();
    expect(text).toContain("[DONE]");

    const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(call[0]).toBe("http://127.0.0.1:1234/v1/chat/completions");
    const sent = JSON.parse(String(call[1].body)) as {
      model: string;
      stream: boolean;
      temperature: number;
      max_tokens: number;
      messages: Array<{ role: string }>;
    };
    expect(sent.model).toBe("MichelRosselli/ternary-bonsai:1.7b-f16");
    expect(sent.stream).toBe(true);
    expect(sent.temperature).toBe(0.6);
    expect(sent.max_tokens).toBe(2048);
    expect(sent.messages[0]?.role).toBe("system");
  });

  it("inoltra il modello Pro quando il client seleziona il tier pro", async () => {
    const fetchMock = vi.fn(async () => sseResponse([SSE_DONE]));
    vi.stubGlobal("fetch", fetchMock);
    const { POST } = await loadRoute();

    await POST(chatRequest({ ...validBody, model: "pro" }));
    const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const sent = JSON.parse(String(call[1].body)) as { model: string };
    expect(sent.model).toBe("qwen3.5:4b");
  });

  it("ricostruisce il contenuto anche con chunk spezzati arbitrariamente", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => sseResponse([delta("Ci"), delta("ao"), SSE_DONE], 3)));
    const { POST } = await loadRoute();

    const res = await POST(chatRequest(validBody));
    const parser = createSseParser();
    let content = "";
    for (const event of parser.feed(await res.text())) {
      if (event === SSE_DONE) break;
      content += parseDeltaContent(event) ?? "";
    }
    expect(content).toBe("Ciao");
  });

  it("invia al modello solo gli ultimi 12 messaggi più il system prompt", async () => {
    const fetchMock = vi.fn(async () => sseResponse([SSE_DONE]));
    vi.stubGlobal("fetch", fetchMock);
    const { POST } = await loadRoute();

    const messages = Array.from({ length: 20 }, (_v, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: `msg-${i}`,
    }));
    await POST(chatRequest({ messages }));

    const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const sent = JSON.parse(String(call[1].body)) as { messages: Array<{ content: string }> };
    expect(sent.messages).toHaveLength(13);
    expect(sent.messages[1]?.content).toBe("msg-8");
  });

  it("rifiuta payload non validi senza contattare l'upstream", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { POST } = await loadRoute();

    const res = await POST(chatRequest({ messages: [{ role: "system", content: "x" }] }));
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rifiuta body eccessivi con 413", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const { POST } = await loadRoute();

    const res = await POST(
      chatRequest({ messages: [{ role: "user", content: "x".repeat(300_000) }] }),
    );
    expect(res.status).toBe(413);
  });

  it("restituisce 502 se l'upstream risponde con errore", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("boom", { status: 500 })));
    const { POST } = await loadRoute();

    const res = await POST(chatRequest(validBody));
    expect(res.status).toBe(502);
  });

  it("restituisce 502 se l'upstream non è raggiungibile", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("ECONNREFUSED"))));
    const { POST } = await loadRoute();

    const res = await POST(chatRequest(validBody));
    expect(res.status).toBe(502);
    const body = (await res.json()) as { error: string };
    expect(body.error).not.toContain("ECONNREFUSED");
  });

  it("restituisce 504 al timeout", async () => {
    process.env.LLM_TIMEOUT_MS = "30";
    vi.stubGlobal("fetch", abortableFetchMock());
    const { POST } = await loadRoute();

    const res = await POST(chatRequest(validBody));
    expect(res.status).toBe(504);
  });

  it("propaga l'abort del client all'upstream", async () => {
    vi.stubGlobal("fetch", abortableFetchMock());
    const { POST } = await loadRoute();

    const controller = new AbortController();
    const pending = POST(chatRequest(validBody, controller.signal));
    setTimeout(() => controller.abort(), 10);
    const res = await pending;
    expect(res.status).toBe(499);
  });

  it("applica il rate limit dopo 20 richieste", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => sseResponse([SSE_DONE])));
    const { POST } = await loadRoute();

    for (let i = 0; i < 20; i += 1) {
      const res = await POST(chatRequest(validBody));
      expect(res.status).toBe(200);
      await res.text();
    }
    const blocked = await POST(chatRequest(validBody));
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).not.toBeNull();
  });
});
