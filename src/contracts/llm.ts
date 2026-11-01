import { z } from "zod";

/** The only place model IDs live. Only the server reads them. */
export const MODEL_IDS = {
  counterpart: "claude-haiku-5-5",
  analysis: "claude-sonnet-5-5",
} as const;

export const LlmPurposeSchema = z.enum(["counterpart", "analysis"]);
export type LlmPurpose = z.infer<typeof LlmPurposeSchema>;

export const LlmMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(100_000),
});
export type LlmMessage = z.infer<typeof LlmMessageSchema>;

export const LlmRequestSchema = z.object({
  purpose: LlmPurposeSchema,
  system: z.string().min(1).max(20_000),
  messages: z.array(LlmMessageSchema).min(1).max(50),
  maxTokens: z.number().int().min(1).max(4096),
  temperature: z.number().min(0).max(1).optional(),
  /** Ask the route to send text as it is written (see LLM_STREAM_CONTENT_TYPE). */
  stream: z.boolean().optional(),
});
export type LlmRequest = z.infer<typeof LlmRequestSchema>;

/** Resolves with the model's text. Rejects only with LlmError. */
export interface LlmClient {
  complete(req: LlmRequest): Promise<string>;
  /**
   * Like complete(), but calls onText with each piece of text as it arrives.
   * Optional: callers fall back to complete() when it is missing.
   */
  stream?(req: LlmRequest, onText: (text: string) => void): Promise<string>;
}
