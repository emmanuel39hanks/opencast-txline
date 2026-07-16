"use client";

import { useQuery } from "@tanstack/react-query";
import { Auth } from "@/lib/api";

export function useUser(wallet: string | undefined) {
  return useQuery({
    queryKey: ["user", wallet?.toLowerCase() ?? null],
    queryFn: () => Auth.getUserByWallet(wallet as string),
    enabled: !!wallet,
  });
}

export function useTopCreators() {
  return useQuery({
    queryKey: ["lb-creators"],
    queryFn: () => Auth.listTopCreators(),
  });
}

export function useTopTraders() {
  return useQuery({
    queryKey: ["lb-traders"],
    queryFn: () => Auth.listTopTraders(),
  });
}
