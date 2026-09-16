import { describe, expect, it } from "vitest";
import { createSseParser, parseDeltaContent, SSE_DONE } from "@/lib/sse";

describe("createSseParser", () => {
  it("estrae un evento completo", () => {
    const parser = createSseParser();
    expect(parser.feed('data: {"a":1}\n\n')).toEqual(['{"a":1}']);
  });

  it("gestisce chunk spezzati in punti arbitrari", () => {
    const parser = createSseParser();
    const payload = 'data: {"choices":[{"delta":{"content":"Ciao"}}]}\n\ndata: [DONE]\n\n';
    const events: string[] = [];
    for (const char of payload) events.push(...parser.feed(char));
    expect(events).toHaveLength(2);
    expect(events[1]).toBe(SSE_DONE);
    expect(parseDeltaContent(events[0] ?? "")).toBe("Ciao");
  });

  it("gestisce più eventi in un unico chunk e i CRLF", () => {
    const parser = createSseParser();
    const events = parser.feed("data: uno\r\n\r\ndata: due\r\n\r\n");
    expect(events).toEqual(["uno", "due"]);
  });

  it("flush restituisce l'eventuale evento residuo", () => {
    const parser = createSseParser();
    expect(parser.feed("data: parziale")).toEqual([]);
    expect(parser.flush()).toEqual(["parziale"]);
  });
});

describe("parseDeltaContent", () => {
  it("estrae il contenuto del delta", () => {
    expect(parseDeltaContent('{"choices":[{"delta":{"content":"x"}}]}')).toBe("x");
  });

  it("restituisce null per JSON non valido o senza contenuto", () => {
    expect(parseDeltaContent("non-json")).toBeNull();
    expect(parseDeltaContent('{"choices":[{"delta":{}}]}')).toBeNull();
    expect(parseDeltaContent("[DONE]")).toBeNull();
  });
});
