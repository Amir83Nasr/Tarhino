"use client"

import { apiStream } from "@/lib/api/client"

import type { ChatMessage } from "@/features/assistant/ai"

// Server-controlled AI. No settings endpoints: the teacher only sends chat.
// Streams token-by-token; the page re-renders the running total on each token.

export function chat(messages: ChatMessage[], onToken: (full: string) => void) {
  return apiStream("/ai/chat", { messages }, onToken)
}
