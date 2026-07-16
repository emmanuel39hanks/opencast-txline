"use client";

/**
 * Create-market hook — stubbed during the Solana migration. Market creation
 * will call the Solana settlement program's create_market (USDC escrow PDA).
 * Export shape preserved so the create wizard compiles.
 */
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import type { CreateMarketInput } from "@/lib/api/markets";

export function useCreateMarket() {
  return useMutation({
    mutationFn: async (
      _input: CreateMarketInput,
    ): Promise<{ marketId?: number; txHash: string }> => {
      toast.error("Market creation is being migrated to Solana (create_market).");
      throw new Error("Not available in the Solana build yet.");
    },
  });
}

/** USDC uses 6 decimals — convert a human amount to base units. */
export function toUsdcUnits(amount: number): bigint {
  return BigInt(Math.round(amount * 1_000_000));
}
