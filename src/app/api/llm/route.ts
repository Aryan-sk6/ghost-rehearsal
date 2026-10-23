import { completeWithAnthropic } from "@/lib/llm/anthropic";
import { handleLlmProxy } from "@/lib/llm/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  return handleLlmProxy(req, { complete: completeWithAnthropic });
}
