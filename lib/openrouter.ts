// lib/openrouter.ts

interface OpenRouterMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface CallOptions {
  apiKey: string;
  model: string;
  fallbackModel?: string; // tried once, after retries on the primary are exhausted
  messages: OpenRouterMessage[];
  maxRetries?: number; // retries on the primary model only, default 2
  retryDelayMs?: number; // base delay, linear backoff, default 1500
}

// NVIDIA's free NIM workers return this when their shared, global capacity
// (across ALL OpenRouter users of the :free model, not just this app) is
// saturated. Confirmed transient/retryable behavior, not an auth or quota
// error, despite what the wording sounds like.
const RETRYABLE_PATTERNS = [
  /ResourceExhausted/i,
  /rate limit/i,
  /overloaded/i,
  /try again/i,
  /503/,
];

function isRetryable(message: string): boolean {
  return RETRYABLE_PATTERNS.some((p) => p.test(message));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callOnce(
  model: string,
  messages: OpenRouterMessage[],
  apiKey: string,
): Promise<{ ok: true; content: string } | { ok: false; message: string }> {
  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, messages, stream: false }),
    },
  );

  if (!response.ok) {
    return { ok: false, message: `http_${response.status}` };
  }

  interface OpenRouterResponse {
    choices?: { message?: { content?: string } }[];
    error?: { message?: string };
  }
  const data = (await response.json()) as OpenRouterResponse;
  if (data.error) {
    return { ok: false, message: data.error.message ?? "unknown" };
  }
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) return { ok: false, message: "empty_response" };
  return { ok: true, content };
}

export async function callOpenRouterWithRetry(
  options: CallOptions,
): Promise<string> {
  const {
    apiKey,
    model,
    fallbackModel,
    messages,
    maxRetries = 2,
    retryDelayMs = 1500,
  } = options;

  let lastMessage = "unknown";
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const result = await callOnce(model, messages, apiKey);
    if (result.ok) return result.content;
    lastMessage = result.message;
    if (!isRetryable(result.message) || attempt === maxRetries) break;
    await sleep(retryDelayMs * (attempt + 1));
  }

  if (fallbackModel) {
    const fallbackResult = await callOnce(fallbackModel, messages, apiKey);
    if (fallbackResult.ok) return fallbackResult.content;
    lastMessage = fallbackResult.message;
  }

  throw new Error(lastMessage);
}
