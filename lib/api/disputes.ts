import { api } from "./client";
import type { Dispute, DisputeCalldata } from "./types";

function unwrap<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (raw && typeof raw === "object" && Array.isArray((raw as { items?: T[] }).items)) {
    return (raw as { items: T[] }).items;
  }
  return [];
}

export async function listDisputesForMarket(
  marketId: number,
  opts?: { signal?: AbortSignal },
): Promise<Dispute[]> {
  const raw = await api.get<unknown>(`/markets/${marketId}/disputes`, {
    anonymous: true,
    signal: opts?.signal,
  });
  return unwrap<Dispute>(raw);
}

export async function listAllDisputes(opts?: { signal?: AbortSignal }): Promise<Dispute[]> {
  const raw = await api.get<unknown>(`/admin/disputes`, { signal: opts?.signal });
  return unwrap<Dispute>(raw);
}

export async function listOpenDisputes(opts?: { signal?: AbortSignal }): Promise<Dispute[]> {
  const all = await listAllDisputes(opts);
  return all.filter((d) => d.status === "OPEN");
}

export interface PostDisputeInput {
  marketId: number;
  reason: string;
  evidenceUrls: string[];
  claimedOutcome: "Yes" | "No";
}

/**
 * Backend stores evidence (S3/IPFS), returns the calldata and evidenceURI.
 * Frontend signs Market.dispute(evidenceURI) with the bond.
 */
export async function prepareDispute(input: PostDisputeInput): Promise<DisputeCalldata> {
  return api.post<DisputeCalldata>(`/markets/${input.marketId}/dispute`, input);
}

export interface ResolveDisputeInput {
  disputeId: string;
  outcome: "Yes" | "No";
  disputerCorrect: boolean;
}

/** Admin action — backend signs on-chain via Safe/approver key. */
export async function resolveDispute(input: ResolveDisputeInput): Promise<{ txHash?: string }> {
  return api.post<{ txHash?: string }>(`/admin/disputes/${input.disputeId}/resolve`, {
    outcome: input.outcome,
    disputerCorrect: input.disputerCorrect,
  });
}
