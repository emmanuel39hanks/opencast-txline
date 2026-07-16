import { api, ApiError } from "./client";
import type { MeResponse, User } from "./types";

/**
 * Sync the Privy-authed session with the backend. Called once per login.
 * Returns the persisted user row with `role`. Tolerates backend outage —
 * caller can treat a thrown ApiError with status 0 as "no role yet".
 */
export async function syncAuth(): Promise<MeResponse> {
  return api.post<MeResponse>(`/auth/sync`);
}

export async function getMe(): Promise<User> {
  const res = await api.get<MeResponse | User>(`/me`);
  // Backend may return either {user: ...} or the user directly.
  if (res && typeof res === "object" && "user" in res) {
    return (res as MeResponse).user;
  }
  return res as User;
}

export async function getUserByWallet(wallet: string): Promise<User | null> {
  try {
    return await api.get<User>(`/users/${wallet}`, { anonymous: true });
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

export async function listTopCreators(): Promise<User[]> {
  try {
    return await api.get<User[]>(`/leaderboard/creators`, { anonymous: true });
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return [];
    throw e;
  }
}

export async function listTopTraders(): Promise<User[]> {
  try {
    return await api.get<User[]>(`/leaderboard/traders`, { anonymous: true });
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return [];
    throw e;
  }
}
