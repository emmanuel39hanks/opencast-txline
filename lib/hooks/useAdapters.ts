"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Adapters } from "@/lib/api";

export function useAdapters() {
  return useQuery({
    queryKey: ["adapters"],
    queryFn: ({ signal }) => Adapters.listAdapters({ signal }),
  });
}

export function useToggleAdapter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { adapterId: string; enabled: boolean }) =>
      Adapters.toggleAdapter(input.adapterId, input.enabled),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["adapters"] }),
    onError: (e: Error) => toast.error("Toggle failed", { description: e.message }),
  });
}

export function useUpdateAdapter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { adapterId: string; patch: Adapters.UpdateAdapterInput }) =>
      Adapters.updateAdapter(input.adapterId, input.patch),
    onSuccess: () => {
      toast.success("Adapter updated");
      qc.invalidateQueries({ queryKey: ["adapters"] });
    },
    onError: (e: Error) => toast.error("Update failed", { description: e.message }),
  });
}

export function useCreateAdapter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Adapters.CreateAdapterInput) => Adapters.createAdapter(input),
    onSuccess: () => {
      toast.success("Adapter created");
      qc.invalidateQueries({ queryKey: ["adapters"] });
    },
    onError: (e: Error) => toast.error("Create failed", { description: e.message }),
  });
}
