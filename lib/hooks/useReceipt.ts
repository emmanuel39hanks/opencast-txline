"use client";

import { useQuery } from "@tanstack/react-query";
import type { Market } from "@/lib/types";

/** The slice of /api/verify the receipt surfaces need. */
export interface Receipt {
  available: boolean;
  final?: boolean;
  seq?: number;
  home?: string | null;
  away?: string | null;
  score?: { home: number; away: number; final: boolean } | null;
  question?: string | null;
  yesLabel?: string | null;
  noLabel?: string | null;
  marketOutcome?: string | null;
  settleTxSig?: string | null;
  dailyRootPda?: string | null;
  predicate?: string;
  predicateParts?: {
    statKeyA: number;
    statKeyB: number;
    threshold: number;
    comparison: number;
  };
  namedStats?: { key: number; label: string; value: number }[];
  impliedOutcome?: "Yes" | "No" | null;
  independentCheck?: "recomputed-ok" | "mismatch" | "unavailable";
  playerFacts?: { goals: string[]; yellows: string[]; reds: string[] } | null;
}

/**
 * The market's settlement receipt — one shared query so the trade panel and
 * the resolution card on the same page hit /api/verify exactly once.
 */
export function useReceipt(market: Market, opts?: { enabled?: boolean }) {
  const pda = (market as { marketPda?: string | null }).marketPda ?? null;
  return useQuery<Receipt>({
    queryKey: ["receipt", market.id, pda],
    queryFn: async ({ signal }) => {
      const qs = pda ? `?m=${pda}` : "";
      const r = await fetch(`/api/verify/${market.id}${qs}`, { signal });
      if (!r.ok) return { available: false };
      return (await r.json()) as Receipt;
    },
    enabled: opts?.enabled ?? true,
    staleTime: 60_000,
  });
}

/**
 * The settlement math, human-readable: "France goals (3) − Iraq goals (0) →
 * 3 > 0 → YES". Returns null until the stats are known.
 */
export function receiptEquation(r: Receipt): string | null {
  const parts = r.predicateParts;
  const stats = r.namedStats;
  if (!parts || !stats?.length) return null;
  const val = (k: number) => stats.find((s) => s.key === k)?.value;
  const a = val(parts.statKeyA);
  if (a == null) return null;
  const cmp = parts.comparison === 0 ? ">" : parts.comparison === 1 ? "<" : "=";
  const labelOf = (k: number) => stats.find((s) => s.key === k)?.label ?? `stat ${k}`;
  if (parts.statKeyB !== 0) {
    const b = val(parts.statKeyB);
    if (b == null) return null;
    return `${labelOf(parts.statKeyA)} (${a}) − ${labelOf(parts.statKeyB)} (${b}) → ${
      a - b
    } ${cmp} ${parts.threshold}`;
  }
  return `${labelOf(parts.statKeyA)} → ${a} ${cmp} ${parts.threshold}`;
}
