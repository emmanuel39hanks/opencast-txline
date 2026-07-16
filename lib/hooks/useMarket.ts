"use client";

import { useQuery } from "@tanstack/react-query";
import { Markets } from "@/lib/api";

export function useMarket(idOrSlug: number | string | undefined) {
  return useQuery({
    queryKey: ["market", idOrSlug],
    queryFn: ({ signal }) =>
      Markets.getMarket(idOrSlug as number | string, { signal }),
    enabled:
      typeof idOrSlug === "string"
        ? idOrSlug.length > 0
        : typeof idOrSlug === "number" && Number.isFinite(idOrSlug),
  });
}

export function useTrades(marketId: number | undefined, limit = 50) {
  return useQuery({
    queryKey: ["market-trades", marketId, limit],
    queryFn: ({ signal }) => Markets.listTrades(marketId as number, limit, { signal }),
    enabled: typeof marketId === "number" && Number.isFinite(marketId),
  });
}

export function useHolders(marketId: number | undefined) {
  return useQuery({
    queryKey: ["market-holders", marketId],
    queryFn: ({ signal }) => Markets.listHolders(marketId as number, { signal }),
    enabled: typeof marketId === "number" && Number.isFinite(marketId),
  });
}
