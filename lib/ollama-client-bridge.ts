/**
 * Ollama Client Bridge
 * Bypass the server completely and query the user's local Ollama directly from the browser.
 */

export async function* streamFromLocalOllama(
  model: string,
  prompt: string,
  systemPrompt?: string
): AsyncGenerator<string, void, unknown> {
  const url = "http://127.0.0.1:1234/v1/chat/completions";
  
  const messages = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
  messages.push({ role: "user", content: prompt });

  const payload = {
    model: model || "local-model",
    messages: messages,
    stream: true,
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`LM Studio direct fetch failed: ${response.statusText}`);
  }

  if (!response.body) {
    throw new Error("No response body from LM Studio");
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
          console.error("Error parsing LM Studio SSE chunk:", e);
        }
      }
    }
  }
}
