import { api } from "./client";
import type { AIDecisionLog } from "./types";

function unwrap<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (raw && typeof raw === "object" && Array.isArray((raw as { items?: T[] }).items)) {
    return (raw as { items: T[] }).items;
  }
  return [];
}

/** Public per-market AI decision log — no auth required. */
export async function listAIDecisions(
  _phase?: string,
  opts?: { signal?: AbortSignal },
): Promise<AIDecisionLog[]> {
  const raw = await api.get<unknown>(`/admin/ai-decisions`, { signal: opts?.signal });
  return unwrap<AIDecisionLog>(raw);
}

export async function getAIDecisionsForMarket(
  marketId: number,
  opts?: { signal?: AbortSignal },
): Promise<AIDecisionLog[]> {
  const raw = await api.get<unknown>(`/markets/${marketId}/ai-decisions`, {
    anonymous: true,
    signal: opts?.signal,
  });
  return unwrap<AIDecisionLog>(raw);
}
