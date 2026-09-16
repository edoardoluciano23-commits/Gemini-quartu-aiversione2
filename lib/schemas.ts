import { z } from "zod";

export const MAX_MESSAGE_LENGTH = 8000;
export const MAX_CHAT_MESSAGES = 50;

export const chatRoleSchema = z.enum(["user", "assistant"]);
export const modelTierSchema = z.enum(["free", "pro", "ultra"]);

export const chatMessageSchema = z
  .object({
    role: chatRoleSchema,
    content: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH),
  })
  .strict();

export const chatRequestSchema = z
  .object({
    messages: z.array(chatMessageSchema).min(1).max(MAX_CHAT_MESSAGES),
    // Il client sceglie solo il "tier": il nome reale del modello resta sul server.
    model: modelTierSchema.optional(),
  })
  .strict();

export const createConversationSchema = z
  .object({
    title: z.string().trim().min(1).max(120).optional(),
  })
  .strict();

export const renameConversationSchema = z
  .object({
    title: z.string().trim().min(1).max(120),
  })
  .strict();

export const appendMessagesSchema = z
  .object({
    messages: z
      .array(
        z
          .object({
            role: chatRoleSchema,
            content: z.string().min(1).max(MAX_MESSAGE_LENGTH),
            status: z.enum(["complete", "incomplete"]).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(2),
    replaceLastAssistant: z.boolean().optional(),
  })
  .strict();

export const conversationIdSchema = z.string().uuid();
