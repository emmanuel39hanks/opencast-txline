"use client";

/**
 * Dispute hook — stubbed during the Solana migration. Export shapes preserved
 * so importers compile.
 */
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import type { PostDisputeInput } from "@/lib/api/disputes";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useDispute(_marketId: number, _onResolved?: () => void) {
  return useMutation({
    mutationFn: async (_input: PostDisputeInput) => {
      toast.error("Disputes are being migrated to Solana.");
      throw new Error("Not available in the Solana build yet.");
    },
  });
}

export function useMarketDisputes(marketId: number | undefined) {
  return {
    queryKey: ["market-disputes", marketId] as const,
  };
}
