"use client";

import { useMutation } from "@tanstack/react-query";
import { Markets } from "@/lib/api";
import type { CreateDraftInput } from "@/lib/api/markets";

/**
 * `mutateAsync` accepts either a bare question string (back-compat) or the
 * full CreateDraftInput when the sports flow needs to pass selectedMatchId.
 */
export function useCreateDraft() {
  return useMutation({
    mutationFn: (input: string | CreateDraftInput) => {
      const dto: CreateDraftInput =
        typeof input === "string" ? { question: input } : input;
      return Markets.createDraft(dto);
    },
  });
}
