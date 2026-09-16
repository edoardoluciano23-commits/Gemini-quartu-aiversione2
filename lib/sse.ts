export const SSE_DONE = "[DONE]";

export interface SseParser {
  feed(chunk: string): string[];
  flush(): string[];
}

function parseBlock(block: string): string | null {
  const data = block
    .split("\n")
    .map((line) => line.replace(/\r$/, ""))
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.replace(/^data:\s?/, ""))
    .join("\n");
  return data.length > 0 ? data : null;
}

// Parser incrementale di eventi SSE: tollera chunk spezzati in punti arbitrari.
export function createSseParser(): SseParser {
  let buffer = "";

  function extract(): string[] {
    const events: string[] = [];
    let separator = buffer.indexOf("\n\n");
    while (separator !== -1) {
      const block = buffer.slice(0, separator);
      buffer = buffer.slice(separator + 2);
      const data = parseBlock(block);
      if (data !== null) events.push(data);
      separator = buffer.indexOf("\n\n");
    }
    return events;
  }

  return {
    feed(chunk: string): string[] {
      buffer += chunk.replace(/\r\n/g, "\n");
      return extract();
    },
    flush(): string[] {
      const rest = buffer;
      buffer = "";
      const data = parseBlock(rest);
      return data !== null ? [data] : [];
    },
  };
}

interface DeltaPayload {
  choices?: Array<{ delta?: { content?: unknown } }>;
}

export function parseDeltaContent(data: string): string | null {
  try {
    const payload = JSON.parse(data) as DeltaPayload;
    const content = payload.choices?.[0]?.delta?.content;
    return typeof content === "string" ? content : null;
  } catch {
    return null;
  }
}
