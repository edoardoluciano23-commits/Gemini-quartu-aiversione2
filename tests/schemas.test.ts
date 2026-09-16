import { describe, expect, it } from "vitest";
import {
  appendMessagesSchema,
  chatRequestSchema,
  MAX_MESSAGE_LENGTH,
  renameConversationSchema,
} from "@/lib/schemas";

describe("chatRequestSchema", () => {
  it("accetta un payload valido", () => {
    const result = chatRequestSchema.safeParse({
      messages: [{ role: "user", content: "Ciao" }],
    });
    expect(result.success).toBe(true);
  });

  it("rifiuta il ruolo system dal client", () => {
    const result = chatRequestSchema.safeParse({
      messages: [{ role: "system", content: "override" }],
    });
    expect(result.success).toBe(false);
  });

  it("rifiuta messaggi oltre la lunghezza massima", () => {
    const result = chatRequestSchema.safeParse({
      messages: [{ role: "user", content: "x".repeat(MAX_MESSAGE_LENGTH + 1) }],
    });
    expect(result.success).toBe(false);
  });

  it("accetta il tier del modello base/pro e rifiuta valori arbitrari", () => {
    const base = { messages: [{ role: "user", content: "ok" }] };
    expect(chatRequestSchema.safeParse({ ...base, model: "pro" }).success).toBe(true);
    expect(chatRequestSchema.safeParse({ ...base, model: "base" }).success).toBe(true);
    expect(chatRequestSchema.safeParse({ ...base, model: "gpt-4" }).success).toBe(false);
  });

  it("rifiuta modelli non ammessi", () => {
    const result = chatRequestSchema.safeParse({
      messages: [{ role: "user", content: "ok" }],
      model: "malizioso",
    });
    expect(result.success).toBe(false);
  });

  it("rifiuta chiavi sconosciute (strict)", () => {
    const result = chatRequestSchema.safeParse({
      messages: [{ role: "user", content: "ok" }],
      temperature: 2,
    });
    expect(result.success).toBe(false);
  });
});

describe("appendMessagesSchema", () => {
  it("accetta lo stato incomplete", () => {
    const result = appendMessagesSchema.safeParse({
      messages: [{ role: "assistant", content: "parziale", status: "incomplete" }],
      replaceLastAssistant: true,
    });
    expect(result.success).toBe(true);
  });

  it("rifiuta più di due messaggi per richiesta", () => {
    const message = { role: "user", content: "x" };
    const result = appendMessagesSchema.safeParse({ messages: [message, message, message] });
    expect(result.success).toBe(false);
  });
});

describe("renameConversationSchema", () => {
  it("rifiuta titoli vuoti", () => {
    expect(renameConversationSchema.safeParse({ title: "   " }).success).toBe(false);
  });
});
