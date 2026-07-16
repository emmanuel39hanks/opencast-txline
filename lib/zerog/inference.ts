/**
 * 0G Compute Network inference — OpenAI-compatible router.
 *
 * OpenCast uses 0G's decentralized, TEE-attested inference to draft prediction
 * markets from natural language. The model runs inside a trusted execution
 * enclave (verifiability: TeeTLS), so the AI drafting step is itself verifiable
 * — a nice complement to TxLINE's verifiable settlement.
 *
 * Server-only: reads ZEROG_API_KEY. Never import into a client component.
 */

const BASE = process.env.ZEROG_BASE_URL ?? "https://router-api.0g.ai/v1";
const KEY = process.env.ZEROG_API_KEY ?? "";
export const ZEROG_MODEL = process.env.ZEROG_MODEL ?? "deepseek-v4-pro";

/** Public, non-secret provenance shown in the UI. */
export const ZEROG_PROVENANCE = {
  provider: "0G Compute Network",
  model: ZEROG_MODEL,
  attestation: "TEE-attested (TeeTLS)",
} as const;

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatOpts {
  temperature?: number;
  maxTokens?: number;
  json?: boolean;
  signal?: AbortSignal;
}

/** Raw chat completion → assistant text. Throws on transport/API error. */
export async function zerogChat(
  messages: ChatMessage[],
  opts: ChatOpts = {},
): Promise<string> {
  if (!KEY) throw new Error("ZEROG_API_KEY not set");
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${KEY}`,
    },
    body: JSON.stringify({
      model: ZEROG_MODEL,
      messages,
      temperature: opts.temperature ?? 0.2,
      max_tokens: opts.maxTokens ?? 800,
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
    }),
    signal: opts.signal,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`0G inference ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("0G inference returned no content");
  return text;
}

/**
 * Chat completion parsed as JSON. Uses the router's json_object mode, and
 * strips ```json fences / reasoning preamble defensively before parsing.
 * Reasoning models sometimes burn the token budget on preamble and truncate
 * the JSON — retry once with a bigger budget and a "JSON only" nudge.
 */
export async function zerogJson<T>(
  messages: ChatMessage[],
  opts: ChatOpts = {},
): Promise<T> {
  try {
    const raw = await zerogChat(messages, { ...opts, json: true });
    return parseJsonLoose<T>(raw);
  } catch {
    const raw = await zerogChat(
      [
        ...messages,
        {
          role: "user",
          content:
            "Your last reply was not parseable. Respond with ONLY the JSON object — no reasoning, no markdown.",
        },
      ],
      { ...opts, json: true, maxTokens: Math.max(800, opts.maxTokens ?? 0) },
    );
    return parseJsonLoose<T>(raw);
  }
}

function parseJsonLoose<T>(raw: string): T {
  const cleaned = raw
    .replace(/```json\s*/gi, "")
    .replace(/```/g, "")
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Fall back to the first {...} block (some models add a preamble).
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1)) as T;
    }
    throw new Error("0G inference did not return valid JSON");
  }
}
