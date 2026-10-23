/**
 * Pulls the first JSON object out of LLM text (handles ```json fences and
 * surrounding prose). Returns undefined when nothing parses.
 */
export function extractJsonObject(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const body = fenced?.[1] ?? text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end <= start) return undefined;
  try {
    return JSON.parse(body.slice(start, end + 1)) as unknown;
  } catch {
    return undefined;
  }
}
