export type ChatRole = "user" | "assistant";
export type MessageStatus = "complete" | "incomplete" | "streaming";

export interface ConversationDto {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

export interface UiMessage {
  id: string;
  role: ChatRole;
  content: string;
  status: MessageStatus;
  createdAt: number;
}
