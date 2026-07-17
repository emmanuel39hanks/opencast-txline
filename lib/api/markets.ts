import { api } from "./client";
import { imageKeyToUrl } from "@/lib/images/api";
import type {
  CreateMarketCalldata,
  DraftResult,
  Holder,
  Market,
  MarketCategory,
  MarketFilters,
  Position,
  Trade,
} from "./types";

// Normalise list responses — backend may return either a bare array or a
// { items: [...] } envelope. We accept both.
function unwrapList<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (raw && typeof raw === "object") {
    // Accept the common envelope keys backend uses across endpoints:
    //   { items: [...] }       — paginated lists (markets)
    //   { trades: [...] }      — /markets/:id/trades
    //   { positions: [...] }   — /markets/:id/positions
    //   { holders: [...] }     — /markets/:id/holders
    //   { disputes: [...] }    — /markets/:id/disputes
    //   { decisions: [...] }   — /admin/ai-decisions (and similar)
    const obj = raw as Record<string, unknown>;
    for (const key of ["items", "trades", "positions", "holders", "disputes", "decisions", "data", "result", "results"]) {
      if (Array.isArray(obj[key])) return obj[key] as T[];
    }
    // Last resort: pick the first array-valued property.
    for (const v of Object.values(obj)) {
      if (Array.isArray(v)) return v as T[];
    }
  }
  return [];
}

const KNOWN_CATEGORIES: MarketCategory[] = [
  "crypto",
  "sports",
  "weather",
  "news",
  "politics",
  "entertainment",
];

/**
 * Resolve a market's category. The deployed backend omits the `category`
 * column from its list/detail payloads, so when it's missing we derive it
 * from the adapter id (crypto_coingecko → crypto, sports_thesportsdb →
 * sports, weather_openmeteo → weather). Manual markets stay uncategorised.
 */
function deriveCategory(raw: unknown): MarketCategory | undefined {
  const r = raw as { category?: unknown; adapterId?: unknown };
  const explicit =
    typeof r?.category === "string" ? r.category.toLowerCase() : null;
  if (explicit && KNOWN_CATEGORIES.includes(explicit as MarketCategory)) {
    return explicit as MarketCategory;
  }
  const aid = typeof r?.adapterId === "string" ? r.adapterId.toLowerCase() : "";
  if (aid.startsWith("crypto")) return "crypto";
  if (aid.startsWith("sports")) return "sports";
  if (aid.startsWith("weather")) return "weather";
  return undefined;
}

/** Deterministic avatar colour from a wallet address. */
function colorFromAddress(addr: string): string {
  const PALETTE = [
    "#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981",
    "#06b6d4", "#ef4444", "#84cc16", "#f97316", "#14b8a6",
  ];
  let hash = 0;
  for (let i = 0; i < addr.length; i++) hash = (hash * 31 + addr.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

/**
 * Convert the backend's Market shape (where `creator` has `walletAddress`
 * and no `avatarColor`) into what frontend components expect. Tolerates
 * missing creator, missing fields. Never returns a creator prop that is
 * itself undefined — callers rely on `market.creator.displayName` not
 * blowing up.
 */
function normaliseMarket(m: unknown): Market {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = m as any;

  // Decimal conventions on chain:
  //   - lmsrB        — 6-decimal (matches USDC)
  //   - qYes / qNo   — 18-decimal (outcome-token shares; PRBMath UD60x18)
  //
  // Internal LMSR math in the contract scales lmsrB up to 18-dec via
  // `b18 = lmsrB * 1e12` and treats qYes/qNo as 18-dec already. The
  // client-side preview (lib/math/lmsr.ts) works in HUMAN units —
  // 1 share = 1 USDC payout, b in USDC — so we have to convert each
  // value with the *correct* decimal scale. Mixing them up (treating
  // share-wei as USDC-wei) makes exp(qYes/b) saturate to infinity and
  // pegs YES at 100% after even a tiny trade.
  const SHARE_PER_WEI = 1_000_000_000_000_000_000; // 1e18
  const USDC_PER_WEI = 1_000_000;                  // 1e6
  const toFloat = (v: unknown, divisor: number): number => {
    if (v === null || v === undefined) return 0;
    if (typeof v === "number") return v;
    const asNum = Number(v);
    if (!Number.isFinite(asNum)) return 0;
    // Anything that looks like wei (>= 1e5) gets scaled. Smaller values
    // are presumed already-human (e.g. seed defaults).
    return asNum >= 1e5 ? asNum / divisor : asNum;
  };
  const lmsrB = toFloat(raw?.lmsrB, USDC_PER_WEI);
  const qYes = toFloat(raw?.qYes, SHARE_PER_WEI);
  const qNo = toFloat(raw?.qNo, SHARE_PER_WEI);
  // totalVolumeUsdc / creatorBond arrive as 6-decimal USDC wei (e.g.
  // "79769879" = $79.77). They're display-only, so scale to human units
  // here — otherwise formatUsdc() reads the raw integer and renders an
  // absurd "$79.77M".
  const totalVolumeUsdc = toFloat(raw?.totalVolumeUsdc, USDC_PER_WEI);
  const creatorBond = toFloat(raw?.creatorBond, USDC_PER_WEI);

  const creatorRaw = raw?.creator ?? null;
  const fallbackAddr =
    typeof raw?.creatorId === "string"
      ? raw.creatorId
      : "0x0000000000000000000000000000000000000000";
  const creator = creatorRaw
    ? {
        id: creatorRaw.id ?? raw?.creatorId ?? "",
        walletAddr:
          creatorRaw.walletAddr ??
          creatorRaw.walletAddress ??
          fallbackAddr,
        displayName:
          creatorRaw.displayName ??
          (creatorRaw.walletAddress
            ? `${String(creatorRaw.walletAddress).slice(0, 6)}…${String(creatorRaw.walletAddress).slice(-4)}`
            : "Anon"),
        avatarColor:
          creatorRaw.avatarColor ??
          colorFromAddress(
            String(creatorRaw.walletAddress ?? creatorRaw.walletAddr ?? fallbackAddr),
          ),
      }
    : {
        id: raw?.creatorId ?? "",
        walletAddr: fallbackAddr,
        displayName: "Anon",
        avatarColor: colorFromAddress(fallbackAddr),
      };
  const imageKey = typeof raw?.imageKey === "string" ? raw.imageKey : null;
  const imageUrl = imageKeyToUrl(imageKey);
  const category = deriveCategory(raw);
  return {
    ...raw,
    lmsrB,
    qYes,
    qNo,
    totalVolumeUsdc,
    creatorBond,
    creator,
    category,
    imageKey,
    imageUrl,
  } as Market;
}

// Map the frontend's single `sort` token onto the backend's sortBy + sortDir
// contract (ListMarketsDto accepts sortBy ∈ {createdAt, endTime,
// totalVolumeUsdc} and sortDir ∈ {asc, desc}).
const SORT_MAP: Record<
  NonNullable<MarketFilters["sort"]>,
  { sortBy: string; sortDir: string }
> = {
  volume: { sortBy: "totalVolumeUsdc", sortDir: "desc" },
  newest: { sortBy: "createdAt", sortDir: "desc" },
  ending_soon: { sortBy: "endTime", sortDir: "asc" },
};

function filterQuery(filters: MarketFilters = {}): string {
  const p = new URLSearchParams();
  // `status` maps 1:1 onto the MarketStatus enum the backend accepts.
  if (filters.status && filters.status !== "all") {
    p.set("status", String(filters.status));
  }
  // Backend free-text param is `q`, not `search`.
  if (filters.search) p.set("q", filters.search);
  // Backend wants sortBy + sortDir, not a single `sort` token.
  if (filters.sort && SORT_MAP[filters.sort]) {
    p.set("sortBy", SORT_MAP[filters.sort].sortBy);
    p.set("sortDir", SORT_MAP[filters.sort].sortDir);
  }
  // NOTE: `category` is intentionally NOT sent. The backend ListMarketsDto has
  // no category param (it filters by adapterId), so the value would be
  // silently stripped by the whitelist ValidationPipe. We filter by
  // Market.category client-side in listMarkets() instead.
  const s = p.toString();
  return s ? `?${s}` : "";
}

async function fetchMarkets(signal?: AbortSignal): Promise<Market[]> {
  const res = await fetch("/api/markets", { signal });
  if (!res.ok) return [];
  const json = (await res.json()) as { markets?: Market[] };
  return json.markets ?? [];
}

export async function listMarkets(
  filters: MarketFilters = {},
  opts?: { signal?: AbortSignal; limit?: number; creator?: string },
): Promise<Market[]> {
  // Markets are World Cup fixtures served by /api/markets (backed by TxLINE).
  let markets = await fetchMarkets(opts?.signal);

  // "Markets I created" — only markets this wallet created on-chain.
  if (opts?.creator) {
    markets = markets.filter(
      (m) =>
        (m as unknown as { creatorWallet?: string | null }).creatorWallet ===
        opts.creator,
    );
  }
  if (filters.category && filters.category !== "all") {
    markets = markets.filter((m) => m.category === filters.category);
  }
  if (filters.search) {
    const q = filters.search.toLowerCase();
    markets = markets.filter((m) => m.question.toLowerCase().includes(q));
  }

  // Match phase — the board filters and ranks by phase, not just on-chain
  // status: a market can be unsettled while its match already ended.
  const phaseOf = (m: Market): "live" | "upcoming" | "settled" | "ended" => {
    const ms = (m as unknown as { matchState?: string }).matchState;
    if (ms === "live" || ms === "upcoming" || ms === "settled" || ms === "ended")
      return ms;
    return m.status === "RESOLVED" ? "settled" : "upcoming";
  };
  if (filters.status && filters.status !== "all") {
    const s = filters.status;
    markets = markets.filter((m) =>
      s === "open"
        ? phaseOf(m) === "upcoming" || phaseOf(m) === "live"
        : s === "ended" || s === "settled"
          ? phaseOf(m) === s
          : m.status === s,
    );
  }

  // Rank: live first, then upcoming (tradeable), then settled receipts, then
  // full-time markets still awaiting their proof. The chosen sort orders
  // within each phase.
  const PHASE_RANK = { live: 0, upcoming: 1, settled: 2, ended: 3 } as const;
  const kickoff = (m: Market) =>
    (m as unknown as { kickoffMs?: number }).kickoffMs ??
    new Date(m.endTime).getTime();
  const vol = (m: Market) => m.totalVolumeUsdc ?? 0;
  const sort = filters.sort ?? "volume";
  markets = [...markets].sort((a, b) => {
    const pr = PHASE_RANK[phaseOf(a)] - PHASE_RANK[phaseOf(b)];
    if (pr !== 0) return pr;
    if (sort === "ending_soon") return kickoff(a) - kickoff(b);
    if (sort === "newest") return kickoff(b) - kickoff(a);
    return vol(b) - vol(a) || kickoff(a) - kickoff(b);
  });

  if (opts?.limit) markets = markets.slice(0, opts.limit);
  return markets;
}

export async function getMarket(
  idOrSlug: number | string,
  opts?: { signal?: AbortSignal },
): Promise<Market> {
  const markets = await fetchMarkets(opts?.signal);
  const key = String(idOrSlug);
  // Slug is the canonical route key (marketPda once created, fixtureId
  // before). Numeric fallback keeps old fixture-id links working — several
  // markets can share a fixture, so prefer the uncreated template entry.
  const base =
    markets.find(
      (m) => (m as unknown as { slug?: string }).slug === key,
    ) ??
    markets.find(
      (m) =>
        String(m.id) === key &&
        !(m as unknown as { marketPda?: string | null }).marketPda,
    ) ??
    markets.find((m) => String(m.id) === key);
  if (!base) throw new Error(`Market ${key} not found`);
  const priceHistory = [
    {
      t: new Date().toISOString(),
      yes: base.priceYes ?? 0.5,
      no: base.priceNo ?? 0.5,
    },
  ];
  return { ...base, priceHistory } as unknown as Market;
}

export interface CreateDraftInput {
  question: string;
  /**
   * Category chosen by the creator in the category picker. Skips the LLM's
   * classifyCategory tool and forces the corresponding adapter, so we never
   * mis-route a "Will it rain in NYC" question to the news adapter.
   */
  category?: "crypto" | "sports" | "weather" | "news" | "politics";
  /** TheSportsDB fixture id the creator selected from the picker. */
  selectedMatchId?: string;
  /** Human-readable fixture label for prompt context. */
  selectedFixtureName?: string;
  /**
   * Sports flow only: locked params from the prefilled card. Includes the
   * stat template, comparison, threshold, expected winner, labels, and
   * fixture metadata used to generate the canonical question.
   */
  lockedSportsParams?: Record<string, unknown>;
  /**
   * Weather flow only: locked params from the prefilled card. Includes the
   * metric, stat template, comparison, threshold + unit, location coords,
   * window, and labels used to generate the canonical question.
   */
  lockedWeatherParams?: Record<string, unknown>;
  /** IANA timezone for relative date hints like "tonight" or "this_weekend". */
  timezone?: string;
}

export interface FixtureCandidate {
  idEvent: string;
  name: string;
  home: string;
  away: string;
  league: string | null;
  dateISO: string | null;
  status: string | null;
}

export async function createDraft(input: CreateDraftInput): Promise<DraftResult> {
  const raw = await api.post<unknown>("/markets/draft", input);
  return normaliseDraft(raw);
}

/**
 * Resolve a user's sports question to candidate TheSportsDB fixtures. The
 * creator picks one, then we re-run /markets/draft with `selectedMatchId`
 * to get a full AI draft locked to that event.
 */
export async function fixtureSearch(input: {
  question?: string;
  query?: string;
  homeTeam?: string;
  awayTeam?: string;
  dateISO?: string;
}): Promise<FixtureCandidate[]> {
  const raw = await api.post<{ candidates?: FixtureCandidate[] }>(
    "/adapters/sports/fixture-search",
    input,
  );
  return Array.isArray(raw?.candidates) ? raw.candidates : [];
}

export interface LiveScore {
  matchId: string;
  home: string;
  away: string;
  homeScore: number | null;
  awayScore: number | null;
  status: string | null;
  kickoffISO: string | null;
  isFinal: boolean;
}

export async function getLiveScore(
  marketId: number,
  opts?: { signal?: AbortSignal },
): Promise<LiveScore | null> {
  const raw = await api.get<{ score: LiveScore | null }>(
    `/markets/${marketId}/live-score`,
    { anonymous: true, signal: opts?.signal },
  );
  return raw?.score ?? null;
}

/**
 * Backend returns the draft in a flat shape:
 *   { question, classification: {category, confidence}, adapterId, source,
 *     decision, suggestedEndTime, suggestedDisputeWindowSec, resolutionRule,
 *     reasoning, confidence, toolCalls, aiDecisionLogId }
 *
 * The frontend UI and mock-era `DraftResult` type expect:
 *   { category, adapter, adapterId, source, suggestedEndTime,
 *     suggestedDisputeWindowSec, resolutionRule, confidence, decision,
 *     reason, aiDecisionLog: { id, toolCalls, ... }, params }
 *
 * This mapper bridges the two so the UI components render without changes.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normaliseDraft(raw: any): DraftResult {
  const classification = raw?.classification ?? {};
  const category = classification.category ?? raw?.category ?? "news";
  const confidence =
    typeof raw?.confidence === "number"
      ? raw.confidence
      : (classification.confidence ?? 0);
  const toolCalls = Array.isArray(raw?.toolCalls)
    ? raw.toolCalls
    : Array.isArray(raw?.aiDecisionLog?.toolCalls)
      ? raw.aiDecisionLog.toolCalls
      : [];
  const aiDecisionLog =
    raw?.aiDecisionLog && typeof raw.aiDecisionLog === "object"
      ? { toolCalls, ...raw.aiDecisionLog }
      : {
          id: raw?.aiDecisionLogId ?? "",
          marketId: 0,
          marketQuestion: raw?.question ?? "",
          phase: "INTAKE",
          model: "",
          prompt: "",
          toolCalls,
          output: {},
          decision: raw?.decision ?? "AUTO_APPROVE",
          confidence,
          createdAt: new Date().toISOString(),
        };

  // adapter — frontend DraftResult wants a full `Adapter` object. The backend
  // only returns `adapterId`; construct a minimal placeholder so the preview
  // card renders. The real catalog is fetched separately via /adapters.
  const adapter = {
    adapterId: raw?.adapterId ?? "",
    category,
    displayName: raw?.adapterId ?? "",
    description: "",
    paramsSchema: {},
    enabled: true,
    trustLevel:
      raw?.source === "Automated"
        ? "deterministic"
        : raw?.source === "LLMAssisted"
          ? "llm-assisted"
          : "manual",
  };

  const status: DraftResult["status"] =
    raw?.status === "awaiting_fixture_selection"
      ? "awaiting_fixture_selection"
      : raw?.status === "awaiting_confirmation"
        ? "awaiting_confirmation"
        : raw?.status === "sport_not_supported"
          ? "sport_not_supported"
          : raw?.status === "awaiting_weather_confirmation"
            ? "awaiting_weather_confirmation"
            : raw?.status === "metric_not_supported"
              ? "metric_not_supported"
              : "draft";
  const candidates = Array.isArray(raw?.candidates)
    ? (raw.candidates as DraftResult["candidates"])
    : undefined;
  const sportsCard =
    raw?.sportsCard && typeof raw.sportsCard === "object"
      ? (raw.sportsCard as DraftResult["sportsCard"])
      : undefined;
  const weatherCard =
    raw?.weatherCard && typeof raw.weatherCard === "object"
      ? (raw.weatherCard as DraftResult["weatherCard"])
      : undefined;
  const canonicalQuestion =
    typeof raw?.canonicalQuestion === "string" ? raw.canonicalQuestion : null;

  return {
    status,
    candidates,
    sportsCard,
    weatherCard,
    canonicalQuestion,
    question: raw?.question ?? "",
    category,
    adapterId: raw?.adapterId ?? "",
    adapter,
    source: raw?.source ?? "Manual",
    suggestedEndTime: raw?.suggestedEndTime ?? null,
    suggestedDisputeWindowSec: raw?.suggestedDisputeWindowSec ?? 3600,
    resolutionRule: raw?.resolutionRule ?? "",
    params: raw?.adapterParams ?? raw?.params ?? {},
    confidence,
    decision: raw?.decision ?? "AUTO_APPROVE",
    reason: raw?.reasoning ?? raw?.reason ?? "",
    yesLabel: typeof raw?.yesLabel === "string" ? raw.yesLabel : null,
    noLabel: typeof raw?.noLabel === "string" ? raw.noLabel : null,
    aiDecisionLog,
    resolutionStatement: typeof raw?.resolutionStatement === "string" ? raw.resolutionStatement : null,
  } as DraftResult;
}

export interface CreateMarketInput {
  /**
   * AIDecisionLog id from the draft step — links this submission to its
   * intake run so the backend skips re-running the agent (and avoids
   * regressing AUTO_APPROVE to NEEDS_HUMAN on the fixture-picker path).
   * Kept as `draftId` on the wire for back-compat; mapped to
   * `aiDecisionLogId` server-side.
   */
  aiDecisionLogId?: string;
  /** @deprecated alias of aiDecisionLogId — both forwarded. */
  draftId?: string;
  question: string;
  category: string;
  adapterId: string;
  source: string;
  endTime: string; // ISO
  disputeWindowSec: number;
  initialLiquidity: number; // human USDC (e.g. 100)
  lmsrB: number;
  creatorBond: number;
  decision: string;
  resolutionRule: string;
  yesLabel?: string | null;
  noLabel?: string | null;
  /**
   * Explicit adapter params to persist on the MarketDraft. Sports flow uses
   * this to lock in the TheSportsDB matchId chosen from the fixture picker,
   * independent of whatever the AI agent traced into its probe call.
   */
  adapterParams?: Record<string, unknown>;
  /**
   * Storage key for the per-market thumbnail (from
   * POST /images/upload-url). Optional — markets without an image fall
   * back to the category icon on cards.
   */
  imageKey?: string;
}

export async function prepareCreateMarket(
  input: CreateMarketInput,
): Promise<CreateMarketCalldata> {
  return api.post<CreateMarketCalldata>("/markets", input);
}

export async function listTrades(
  marketId: number,
  limit = 50,
  opts?: { signal?: AbortSignal },
): Promise<Trade[]> {
  const raw = await api.get<unknown>(`/markets/${marketId}/trades?limit=${limit}`, {
    anonymous: true,
    signal: opts?.signal,
  });
  return unwrapList<unknown>(raw).map(normaliseTrade);
}

/**
 * Backend returns each trade with `user.walletAddress` (no avatarColor /
 * walletAddr). Frontend components expect `user.walletAddr` + avatarColor
 * + a friendly displayName. Also: shares/usdcAmount come back as wei
 * strings — convert to human floats so the UI can format directly.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normaliseTrade(raw: any): Trade {
  const u = raw?.user ?? null;
  const fallbackAddr =
    typeof u?.walletAddress === "string"
      ? u.walletAddress
      : "0x0000000000000000000000000000000000000000";
  const user = {
    id: u?.id ?? raw?.userId ?? "",
    walletAddr: u?.walletAddr ?? u?.walletAddress ?? fallbackAddr,
    displayName:
      u?.displayName ??
      (fallbackAddr
        ? `${fallbackAddr.slice(0, 6)}…${fallbackAddr.slice(-4)}`
        : "Anon"),
    avatarColor: u?.avatarColor ?? colorFromAddress(fallbackAddr),
  };
  // shares are 18-dec, usdcAmount 6-dec on chain. UI wants human floats.
  const sharesNum =
    typeof raw?.shares === "number"
      ? raw.shares
      : (() => {
          const n = Number(raw?.shares);
          return Number.isFinite(n) ? n / 1e18 : 0;
        })();
  const usdcNum =
    typeof raw?.usdcAmount === "number"
      ? raw.usdcAmount
      : (() => {
          const n = Number(raw?.usdcAmount);
          return Number.isFinite(n) ? n / 1e6 : 0;
        })();
  return {
    ...raw,
    user,
    shares: sharesNum,
    usdcAmount: usdcNum,
  } as Trade;
}

export async function listHolders(
  marketId: number,
  opts?: { signal?: AbortSignal },
): Promise<Holder[]> {
  const raw = await api.get<unknown>(`/markets/${marketId}/positions`, {
    anonymous: true,
    signal: opts?.signal,
  });
  return unwrapList<Holder>(raw);
}

/** Portfolio — positions for the authenticated user. */
export async function getMyPositions(opts?: { signal?: AbortSignal }): Promise<Position[]> {
  // Backend may expose this as /me/positions or /portfolio; try canonical first.
  // TODO: depends on backend shape — backend may evolve this endpoint.
  const raw = await api.get<unknown>(`/me/positions`, { signal: opts?.signal });
  return unwrapList<Position>(raw);
}

export interface ReportTradeInput {
  marketId: number;
  side: "Yes" | "No";
  txHash: string;
  usdcIn: number;
  sharesExpected?: number;
}

/**
 * Optional: after a trade mines, tell the backend so it can reconcile/index
 * without waiting on the chain sweep. Returns void; errors are non-fatal.
 * TODO: depends on backend exposing this; ignored if 404.
 */
export async function reportTrade(input: ReportTradeInput): Promise<void> {
  try {
    await api.post<unknown>(`/markets/${input.marketId}/trades`, input);
  } catch {
    /* non-fatal */
  }
}
