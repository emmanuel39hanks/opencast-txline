/**
 * Server-only TxLINE data client. Holds a short-lived guest JWT (auto-renewed
 * on 401/403) and sends the long-lived X-Api-Token on every request. Never
 * import from a client component — TXLINE.apiToken is a server secret.
 */
import { TXLINE } from "./config";
import type {
  TxFixture,
  TxScoreRecord,
  TxStatValidation,
} from "./types";

let cachedJwt: string | null = null;

async function getJwt(force = false): Promise<string> {
  if (cachedJwt && !force) return cachedJwt;
  const res = await fetch(TXLINE.jwtUrl, { method: "POST", cache: "no-store" });
  if (!res.ok) throw new Error(`TxLINE guest JWT failed: ${res.status}`);
  const json = (await res.json()) as { token: string };
  cachedJwt = json.token;
  return cachedJwt;
}

async function txFetch(path: string, init?: RequestInit): Promise<Response> {
  if (!TXLINE.apiToken) {
    throw new Error(
      "TXLINE_API_TOKEN is not set — run `npm run txline:activate` and paste the token into .env",
    );
  }
  const call = async (jwt: string) =>
    fetch(`${TXLINE.apiBaseUrl}${path}`, {
      ...init,
      headers: {
        ...(init?.headers ?? {}),
        Authorization: `Bearer ${jwt}`,
        "X-Api-Token": TXLINE.apiToken,
      },
      cache: "no-store",
    });

  let res = await call(await getJwt());
  if (res.status === 401 || res.status === 403) {
    // Guest JWT likely expired — renew once and retry.
    res = await call(await getJwt(true));
  }
  return res;
}

async function txJson<T>(path: string): Promise<T> {
  const res = await txFetch(path);
  if (!res.ok) {
    throw new Error(`TxLINE ${path} → ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as T;
}

/**
 * Open a TxLINE Server-Sent-Events stream (e.g. `/scores/stream`) with the
 * same auth + JWT-renewal handling as JSON calls. Returns the raw Response so
 * the caller can pipe `res.body` downstream.
 */
export function txStream(path: string): Promise<Response> {
  return txFetch(path, {
    headers: {
      Accept: "text/event-stream",
      "Accept-Encoding": "deflate",
    },
  });
}

/** World Cup (or given competition) fixtures. */
export function getFixtures(opts?: {
  competitionId?: number;
  startEpochDay?: number;
}): Promise<TxFixture[]> {
  const cid = opts?.competitionId ?? TXLINE.competitionId;
  const params = new URLSearchParams({ competitionId: String(cid) });
  if (opts?.startEpochDay != null)
    params.set("startEpochDay", String(opts.startEpochDay));
  return txJson<TxFixture[]>(`/fixtures/snapshot?${params.toString()}`);
}

// ── Full-tournament fixture sweep ───────────────────────────────────────────
// The fixtures snapshot returns a rolling window; the free tier's historical
// replay keeps every past match queryable via `startEpochDay`. Sweeping the
// tournament window yields the complete 104-match schedule. Fixture metadata
// is static, so cache the sweep.
let fixtureSweep: { at: number; data: TxFixture[] } | null = null;
const SWEEP_TTL_MS = 10 * 60 * 1000;
const SWEEP_BACK_DAYS = 45;
const SWEEP_FWD_DAYS = 7;

export async function getAllTournamentFixtures(): Promise<TxFixture[]> {
  if (fixtureSweep && Date.now() - fixtureSweep.at < SWEEP_TTL_MS) {
    return fixtureSweep.data;
  }
  const today = Math.floor(Date.now() / 86_400_000);
  const days: number[] = [];
  for (let d = today - SWEEP_BACK_DAYS; d <= today + SWEEP_FWD_DAYS; d++) days.push(d);

  const all = new Map<number, TxFixture>();
  // Small batches keep us polite to the API while the sweep stays fast.
  const BATCH = 8;
  for (let i = 0; i < days.length; i += BATCH) {
    const chunk = days.slice(i, i + BATCH);
    const results = await Promise.all(
      chunk.map((d) => getFixtures({ startEpochDay: d }).catch(() => [])),
    );
    for (const list of results) for (const f of list) all.set(f.FixtureId, f);
  }
  const data = [...all.values()].sort(
    (a, b) => new Date(a.StartTime).getTime() - new Date(b.StartTime).getTime(),
  );
  // Never cache an empty sweep (transient API failure would blank the app).
  if (data.length) fixtureSweep = { at: Date.now(), data };
  return data.length ? data : (fixtureSweep?.data ?? []);
}

export function getScoreSnapshot(fixtureId: number): Promise<TxScoreRecord[]> {
  return txJson<TxScoreRecord[]>(`/scores/snapshot/${fixtureId}`);
}

export function getOddsSnapshot(fixtureId: number): Promise<unknown[]> {
  return txJson<unknown[]>(`/odds/snapshot/${fixtureId}`);
}

/**
 * Fetch the Merkle proof + payload used to call validate_stat_v2 on-chain.
 * `seq` must be a real sequence observed from a score record/stream (≥1).
 */
export function getStatValidation(
  fixtureId: number,
  seq: number,
  statKeys: number[],
): Promise<TxStatValidation> {
  const params = new URLSearchParams({
    fixtureId: String(fixtureId),
    seq: String(seq),
    statKeys: statKeys.join(","),
  });
  return txJson<TxStatValidation>(`/scores/stat-validation?${params.toString()}`);
}

/** True once a score record marks the match final. */
export function isFinal(rec: TxScoreRecord): boolean {
  if (rec.Action === "game_finalised") return true;
  if (rec.StatusId === 100 && rec.Period === 100) return true;
  return ["F", "FET", "FPE"].includes(rec.GamePhase ?? "");
}
