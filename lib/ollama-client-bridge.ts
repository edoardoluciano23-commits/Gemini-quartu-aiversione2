/**
 * Local AI Client Bridge (LM Studio / Ollama)
 * Direct browser streaming query to local servers on port 1234 or 11434.
 */

export interface ChatMessagePayload {
  role: string;
  content: string;
}

export async function* streamFromLocalOllama(
  model: string,
  messagesInput: string | ChatMessagePayload[],
  systemPrompt?: string
): AsyncGenerator<string, void, unknown> {
  const endpoints = [
    "http://127.0.0.1:1234/v1/chat/completions",
    "http://localhost:1234/v1/chat/completions",
    "http://127.0.0.1:11434/v1/chat/completions",
    "http://localhost:11434/v1/chat/completions",
  ];

  let formattedMessages: ChatMessagePayload[] = [];
  if (Array.isArray(messagesInput)) {
    formattedMessages = [...messagesInput];
    if (systemPrompt && !formattedMessages.some((m) => m.role === "system")) {
      formattedMessages.unshift({ role: "system", content: systemPrompt });
    }
  } else {
    if (systemPrompt) formattedMessages.push({ role: "system", content: systemPrompt });
    formattedMessages.push({ role: "user", content: messagesInput });
  }

  const payload = {
    model: model || "local-model",
    messages: formattedMessages,
    stream: true,
  };

  let response: Response | null = null;
  let lastError: Error | null = null;

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      if (res.ok && res.body) {
        response = res;
        break;
      }
    } catch (err: any) {
      lastError = err;
    }
  }

  if (!response || !response.body) {
    throw new Error(
      `Impossibile connettersi al server locale (LM Studio su :1234 o Ollama su :11434). Verificare che sia avviato con supporto CORS.`
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split("\n").filter((l) => l.trim().length > 0);

    for (const line of lines) {
      if (line === "data: [DONE]") return;
      if (line.startsWith("data: ")) {
        try {
          const data = JSON.parse(line.slice(6));
          const content = data.choices?.[0]?.delta?.content;
          if (content) {
            yield content;
          }
        } catch (e) {
          console.error("Error parsing Local AI SSE chunk:", e);
        }
      }
    }
  }
}
