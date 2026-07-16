"use client";

/**
 * Portfolio / claim compatibility hooks. The live claim path is the on-chain
 * claim in components/market/market-actions.tsx; the positions query here
 * returns empty so any generic list UI renders its normal empty state.
 */
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useWallet } from "@/lib/wallet";
import type { Position } from "@/lib/types";

// Declares a resolved shape so callers that read `res.txHash` typecheck; the
// body always throws — the real claim lives in market-actions.tsx.
function notMigrated(): { txHash: string } {
  toast.error("Claiming happens on the market page.");
  throw new Error("Use the claim button on the market page.");
}

export function useClaim() {
  return useMutation({
    mutationFn: async (_vars: { marketId: number; marketAddress: string }) =>
      notMigrated(),
  });
}

export function useReclaimBond() {
  return useMutation({
    mutationFn: async (_vars: { marketId: number; marketAddress: string }) =>
      notMigrated(),
  });
}

export function useReleaseBond() {
  return useMutation({
    mutationFn: async (_vars: { marketId: number }) => notMigrated(),
  });
}

export function useMyPositions() {
  const { address } = useWallet();
  return useQuery<Position[]>({
    queryKey: ["portfolio", address],
    enabled: !!address,
    staleTime: 10_000,
    queryFn: async () => {
      if (!address) return [];
      const r = await fetch(`/api/portfolio/${address}`);
      if (!r.ok) return [];
      const j = (await r.json()) as { positions?: Position[] };
      return j.positions ?? [];
    },
  });
}
