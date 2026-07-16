"use client";

import { useQuery } from "@tanstack/react-query";
import { Markets } from "@/lib/api";
import type { MarketFilters } from "@/lib/api";

export function useMarkets(
  filters: MarketFilters = {},
  opts?: {
    creator?: string;
    limit?: number;
    enabled?: boolean;
    /** Poll interval in ms — e.g. to keep pool prices live. */
    refetchInterval?: number;
  },
) {
  return useQuery({
    queryKey: ["markets", filters, opts?.creator ?? null, opts?.limit ?? null],
    queryFn: ({ signal }) =>
      Markets.listMarkets(filters, {
        signal,
        creator: opts?.creator,
        limit: opts?.limit,
      }),
    enabled: opts?.enabled ?? true,
    refetchInterval: opts?.refetchInterval,
  });
}

export function useFeaturedMarkets(limit = 6) {
  return useMarkets({ sort: "volume", status: "ACTIVE" }, { limit });
}
