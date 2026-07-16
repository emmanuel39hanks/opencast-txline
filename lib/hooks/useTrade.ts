"use client";

/**
 * Trade hook — stubbed during the Solana migration. Trading will route through
 * the Solana settlement program's place_prediction instruction. Export shape
 * preserved (mutateAsync / isPending) so the trade panel compiles.
 */
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Market } from "@/lib/api";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useTrade(_market: Market) {
  return useMutation({
    mutationFn: async (_vars: {
      mode: "buy" | "sell";
      side: "Yes" | "No";
      usdcIn?: number;
      sharesIn?: number;
      minShares?: number;
      minUsdcOut?: number;
    }): Promise<{ txHash: string }> => {
      toast.error("Trading is being migrated to Solana (place_prediction).");
      throw new Error("Not available in the Solana build yet.");
    },
  });
}
