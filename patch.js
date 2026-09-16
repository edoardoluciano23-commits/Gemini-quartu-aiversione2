const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'components/chat/chat-shell.tsx');
let content = fs.readFileSync(file, 'utf8');

// Add import for webLlmEngine
content = content.replace(
  'import { MessageComposer } from "./message-composer";',
  `import { MessageComposer } from "./message-composer";\nimport { webLlmEngine } from "@/lib/web-llm-engine";`
);

// Replace streamAssistant body
const streamAssitantRegex = /async function streamAssistant\([\s\S]*?\} catch \(err\)/;
const replacement = `async function streamAssistant(
    currentMessages: UiMessage[],
    conversationId: string,
    regenerateTargetId?: string,
  ): Promise<void> {
    const controller = new AbortController();
    abortRef.current = controller;
    setIsStreaming(true);
    setError(null);
    const tempId = regenerateTargetId ?? \`assistant-\${Date.now()}\`;
    const windowSlice = currentMessages.slice(-CONTEXT_WINDOW);
    const payloadMessages = windowSlice.map((m) => ({ role: m.role, content: m.content }));
    
    let firstToken = true;
    let accumulated = "";
    try {
      if (!webLlmEngine || !webLlmEngine.hasSupport()) {
        throw new Error("WebGPU non supportato sul tuo browser. Usa un browser compatibile.");
      }
      
      const status = await webLlmEngine.checkStatus();
      if (!status[tier]) {
        throw new Error(\`Il modello \${tier} non è installato o non è carico. Apri il gestore modelli per scaricarlo ed avviarlo.\`);
      }
      
      if (webLlmEngine.currentTier !== tier) {
        throw new Error(\`Il modello \${tier} non è in memoria. Avvialo dal gestore modelli.\`);
      }

      const stream = webLlmEngine.generateStream(payloadMessages, (fullText) => {
          if (controller.signal.aborted) return;
          accumulated = fullText;
          if (firstToken) {
            firstToken = false;
            setMessages((prev) => {
              if (regenerateTargetId !== undefined) {
                return prev.map((m) => m.id === regenerateTargetId ? { ...m, content: accumulated, status: "complete" } : m);
              }
              const nextAssistant: UiMessage = { id: tempId, role: "assistant", content: accumulated, status: "complete", createdAt: Date.now() };
              return [...prev, nextAssistant];
            });
          } else {
            setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, content: accumulated } : m)));
          }
      });
      
      for await (const chunk of stream) {
        if (controller.signal.aborted) break;
      }

    } catch (err)`;

content = content.replace(streamAssitantRegex, replacement);

fs.writeFileSync(file, content);
