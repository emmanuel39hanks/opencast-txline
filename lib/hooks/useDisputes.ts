"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Disputes } from "@/lib/api";

export function useDisputesForMarket(marketId: number | undefined) {
  return useQuery({
    queryKey: ["market-disputes", marketId],
    queryFn: ({ signal }) =>
      Disputes.listDisputesForMarket(marketId as number, { signal }),
    enabled: typeof marketId === "number" && Number.isFinite(marketId),
  });
}

export function useOpenDisputes() {
  return useQuery({
    queryKey: ["disputes-open"],
    queryFn: ({ signal }) => Disputes.listOpenDisputes({ signal }),
  });
}

export function useAllDisputes() {
  return useQuery({
    queryKey: ["disputes"],
    queryFn: ({ signal }) => Disputes.listAllDisputes({ signal }),
  });
}

export function useResolveDispute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { disputeId: string; outcome: "Yes" | "No"; disputerCorrect: boolean }) =>
      Disputes.resolveDispute(input),
    onSuccess: () => {
      toast.success("Dispute resolved");
      qc.invalidateQueries({ queryKey: ["disputes"] });
      qc.invalidateQueries({ queryKey: ["disputes-open"] });
      qc.invalidateQueries({ queryKey: ["markets"] });
    },
    onError: (e: Error) => toast.error("Resolve failed", { description: e.message }),
  });
}
