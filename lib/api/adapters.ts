import { api } from "./client";
import type { Adapter } from "./types";

function unwrap<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    for (const key of ["adapters", "items", "data", "results"]) {
      if (Array.isArray(obj[key])) return obj[key] as T[];
    }
  }
  return [];
}

export async function listAdapters(opts?: { signal?: AbortSignal }): Promise<Adapter[]> {
  const raw = await api.get<unknown>(`/adapters`, { anonymous: true, signal: opts?.signal });
  return unwrap<Adapter>(raw);
}

export async function probeAdapter(
  adapterId: string,
  params: Record<string, unknown>,
): Promise<{ supported: boolean; sample?: unknown; error?: string }> {
  return api.post(`/adapters/${adapterId}/probe`, { params });
}

export async function toggleAdapter(adapterId: string, enabled: boolean): Promise<Adapter> {
  return api.patch<Adapter>(`/admin/adapters/${adapterId}`, { enabled });
}

export interface UpdateAdapterInput {
  resolverAddr?: string;
  description?: string;
  enabled?: boolean;
  displayName?: string;
}

export async function updateAdapter(adapterId: string, patch: UpdateAdapterInput): Promise<Adapter> {
  return api.patch<Adapter>(`/admin/adapters/${adapterId}`, patch);
}

export interface CreateAdapterInput {
  adapterId: string;
  category: string;
  displayName: string;
  description: string;
  resolverAddr?: string;
  paramsSchema?: Record<string, unknown>;
}

export async function createAdapter(input: CreateAdapterInput): Promise<Adapter> {
  return api.post<Adapter>(`/owner/adapters`, input);
}
