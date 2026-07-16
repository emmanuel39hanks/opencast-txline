"use client";

import { useQuery } from "@tanstack/react-query";
import * as Admin from "@/lib/api/admin";
import type { AIDecisionLog } from "@/lib/api/types";

export function useAIDecisions(phase?: "INTAKE" | "SETTLEMENT" | "DISPUTE_REVIEW") {
  return useQuery<AIDecisionLog[]>({
    queryKey: ["ai-decisions", phase ?? "ALL"],
    queryFn: ({ signal }) => Admin.listAIDecisions(phase, { signal }),
  });
}

export function useAIDecisionsForMarket(marketId: number | undefined) {
  return useQuery<AIDecisionLog[]>({
    queryKey: ["market-ai", marketId],
    queryFn: ({ signal }) =>
      Admin.getAIDecisionsForMarket(marketId as number, { signal }),
    enabled: typeof marketId === "number" && Number.isFinite(marketId),
  });
}
