// Shared types mirroring the on-chain / backend contract shapes.

export type MarketStatus =
  | "DRAFT"
  | "PENDING_APPROVAL"
  | "ACTIVE"
  | "CLOSED"
  | "PENDING_RESOLUTION"
  | "DISPUTED"
  | "RESOLVED"
  | "CANCELLED";

export type MarketSource = "Manual" | "Automated" | "LLMAssisted";
export type Outcome = "None" | "Yes" | "No";
export type AIPhase = "INTAKE" | "SETTLEMENT" | "DISPUTE_REVIEW";
export type DisputeStatus = "OPEN" | "UPHELD" | "REJECTED";
export type MarketCategory =
  | "crypto"
  | "sports"
  | "weather"
  | "news"
  | "politics"
  | "entertainment";

export interface User {
  id: string;
  walletAddr: string;
  displayName: string;
  avatarColor: string;
  bio: string;
  createdAt: string;
  marketsCreated: number;
  totalVolumeUsdc: number;
  accuracy: number; // 0-1
  isAdmin: boolean;
}

export interface PricePoint {
  t: number; // unix ms
  yes: number; // 0-1
}

export interface Market {
  id: number;
  contractAddress: string;
  creatorId: string;
  creator: Pick<User, "id" | "walletAddr" | "displayName" | "avatarColor">;
  question: string;
  questionHash: string;
  category: MarketCategory;
  startTime: string;
  endTime: string;
  disputeWindowSec: number;
  disputeWindowEnd?: string;
  lmsrB: number;
  adapterId: string | null;
  source: MarketSource;
  status: MarketStatus;
  proposedOutcome?: Outcome;
  finalOutcome?: Outcome;
  resolveEvidenceURI?: string;
  disputeEvidenceURI?: string;
  resolvedAt?: string;
  finalizedAt?: string;
  priceYes: number;
  priceNo: number;
  priceHistory: PricePoint[];
  totalVolumeUsdc: number;
  creatorBond: number;
  creationTxHash: string;
  qYes: number;
  qNo: number;
  collateral: number;
  description?: string;
  aiConfidence?: number;
  resolutionRule?: string;
  /** Custom display labels for Yes / No outcomes. Null → fall back to "Yes"/"No". */
  yesLabel?: string | null;
  noLabel?: string | null;
  /** Match phase from the TxLINE feed, distinct from on-chain settlement. */
  matchState?: "upcoming" | "live" | "ended" | "settled";
  /** Kickoff time (unix ms). */
  kickoffMs?: number;
  /** Storage key for the market thumbnail (raw form from backend). */
  imageKey?: string | null;
  /** Fully-qualified URL the UI renders. Null when no image uploaded. */
  imageUrl?: string | null;
  /** On-chain automation config (adapter + resolved probe params). */
  automation?: {
    marketId: number;
    adapterId: string;
    params: Record<string, unknown>;
    snapshotTakenAt?: string | null;
    snapshotValue?: string | number | null;
    resolveValue?: string | number | null;
  } | null;
  /** Optional evidence anchors — unused in the current build. */
  questionStorageRoot?: string | null;
  questionSha256?: string | null;
  verdictStorageRoot?: string | null;
  verdictSha256?: string | null;
  disputeReceiptStorageRoot?: string | null;
  disputeReceiptSha256?: string | null;
}

export interface Trade {
  id: string;
  marketId: number;
  userId: string;
  user: Pick<User, "walletAddr" | "displayName" | "avatarColor">;
  buy: boolean;
  outcome: "Yes" | "No";
  usdcAmount: number;
  shares: number;
  price: number;
  txHash: string;
  blockNumber: number;
  createdAt: string;
}

export interface Holder {
  userId: string;
  user: Pick<User, "walletAddr" | "displayName" | "avatarColor">;
  yesShares: number;
  noShares: number;
  costBasis: number;
  pnl: number;
}

export interface Dispute {
  id: string;
  marketId: number;
  market: Pick<Market, "id" | "question" | "status">;
  disputerId: string;
  disputer: Pick<User, "walletAddr" | "displayName" | "avatarColor">;
  bondUsdc: number;
  evidenceURI: string;
  reason: string;
  evidenceUrls: string[];
  proposedOutcome: "Yes" | "No";
  claimedOutcome: "Yes" | "No";
  status: DisputeStatus;
  createdAt: string;
  resolvedAt?: string;
}

export interface ToolCall {
  tool: string;
  args: Record<string, unknown>;
  result: unknown;
  durationMs: number;
}

export interface AIDecisionLog {
  id: string;
  marketId: number;
  marketQuestion: string;
  phase: AIPhase;
  model: string;
  prompt: string;
  toolCalls: ToolCall[];
  output: Record<string, unknown>;
  confidence: number;
  decision: string;
  humanOverride?: string;
  createdAt: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
}

export interface Adapter {
  adapterId: string;
  category: string;
  displayName: string;
  description: string;
  paramsSchema: Record<string, unknown>;
  enabled: boolean;
  resolverAddr: string;
  trustLevel: "deterministic" | "llm-assisted" | "manual";
  avgResolveMs: number;
  volumeResolvedUsdc: number;
}

export interface Position {
  marketId: number;
  market: Pick<Market, "id" | "question" | "status" | "priceYes" | "endTime" | "finalOutcome">;
  yesShares: number;
  noShares: number;
  costBasis: number;
  currentValue: number;
  pnl: number;
  claimable: boolean;
  claimableAmount: number;
}

export type DraftStatus =
  | "draft"
  | "awaiting_fixture_selection"
  | "awaiting_confirmation"
  | "sport_not_supported"
  | "awaiting_weather_confirmation"
  | "metric_not_supported";

export interface DraftFixtureCandidate {
  idEvent: string;
  name: string;
  home: string;
  away: string;
  league: string | null;
  dateISO: string | null;
  status: string | null;
}

export interface SportsCardExtraction {
  sport: string;
  teams: string[];
  opponent: string | null;
  league: string | null;
  dateHint: string | null;
  statTemplate: string;
  threshold: number | null;
  comparison: "gt" | "gte" | "lt" | "lte" | "eq" | null;
  expectedSide: "home" | "away" | "draw" | null;
  yesLabel: string | null;
  noLabel: string | null;
  fieldConfidence: { teams: number; statTemplate: number; threshold: number };
}

export interface SportsCardPayload {
  selectedFixture: DraftFixtureCandidate | null;
  alternativeFixtures: DraftFixtureCandidate[];
  extracted: SportsCardExtraction;
  reason?: string;
}

export interface WeatherCardExtraction {
  location: string | null;
  metric: string;
  statTemplate: string;
  threshold: number | null;
  unit: string | null;
  comparison: "gt" | "gte" | "lt" | "lte" | "eq" | null;
  dateHint: string | null;
  yesLabel: string | null;
  noLabel: string | null;
  fieldConfidence: { location: number; metric: number; threshold: number };
}

export interface DraftGeocodeCandidate {
  name: string;
  admin1: string | null;
  country: string;
  countryCode: string;
  latitude: number;
  longitude: number;
  population: number | null;
  timezone: string;
  label: string;
}

export interface WeatherCardPayload {
  selectedLocation: DraftGeocodeCandidate | null;
  alternativeLocations: DraftGeocodeCandidate[];
  extracted: WeatherCardExtraction;
  window?: { startISO: string; endISO: string; isDefault: boolean };
}

export interface DraftResult {
  /**
   * `draft` (default) → full AI draft ready to review.
   * `awaiting_fixture_selection` → legacy sports picker (regex flow).
   * `awaiting_confirmation` → new question-first sports prefilled card.
   * `sport_not_supported` → sports question for an unsupported sport.
   */
  status: DraftStatus;
  candidates?: DraftFixtureCandidate[];
  /** Populated when status === "awaiting_confirmation" or "sport_not_supported". */
  sportsCard?: SportsCardPayload;
  /** Populated when status === "awaiting_weather_confirmation" or "metric_not_supported". */
  weatherCard?: WeatherCardPayload;
  /** Server-generated canonical question (sports flow only). */
  canonicalQuestion?: string | null;

  question: string;
  category: MarketCategory;
  adapterId: string;
  adapter: Adapter;
  source: MarketSource;
  /** ISO timestamp the AI extracted, or null when the user must pick one. */
  suggestedEndTime: string | null;
  suggestedDisputeWindowSec: number;
  resolutionRule: string;
  params: Record<string, unknown>;
  confidence: number;
  decision: "AUTO_APPROVE" | "NEEDS_HUMAN" | "REJECT";
  reason: string;
  /** AI-suggested display labels. Null → UI prompts creator for "Yes"/"No" fallback. */
  yesLabel?: string | null;
  noLabel?: string | null;
  aiDecisionLog: AIDecisionLog;
  /** Concrete resolution statement built from live probe data. Null for manual/news markets. */
  resolutionStatement: string | null;
}

export interface MarketFilters {
  /**
   * On-chain status ("ACTIVE"/"RESOLVED") or a match-phase shortcut:
   * "open" = upcoming|live, "ended" = full-time awaiting proof, "settled".
   */
  status?: MarketStatus | "all" | "open" | "ended" | "settled";
  category?: MarketCategory | "all";
  search?: string;
  sort?: "volume" | "newest" | "ending_soon";
}

export interface Alert {
  id: string;
  severity: "info" | "warning" | "critical";
  title: string;
  description: string;
  marketId?: number;
  createdAt: string;
  status: "open" | "acknowledged";
}
