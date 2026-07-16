"use client";

import { useQuery } from "@tanstack/react-query";
import { Markets } from "@/lib/api";

/**
 * Live score for a sports market. The backend keeps a TTL cache so we can
 * poll freely without hammering TheSportsDB. We still use a long
 * `refetchInterval` (5 min) to avoid churning React state in inactive tabs.
 *
 * Returns `null` for non-sports markets (backend responds with `null` score).
 */
export function useLiveScore(
  marketId: number | undefined,
  opts?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: ["live-score", marketId],
    queryFn: ({ signal }) => Markets.getLiveScore(marketId!, { signal }),
    enabled: (opts?.enabled ?? true) && typeof marketId === "number",
    refetchInterval: (query) => {
      // Final scores don't change — stop polling.
      const d = query.state.data;
      if (d && d.isFinal) return false;
      return 5 * 60 * 1000;
    },
    // 30s stale-time aligns with "refresh when the user returns to the tab".
    staleTime: 30_000,
  });
}
