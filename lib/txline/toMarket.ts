/**
 * Map a TxLINE fixture (+ optional persisted on-chain market) into the
 * frontend `Market` shape. When a market has been created on-chain, we merge
 * its PDA + live YES/NO pools so pricing + volume are real.
 */
import type { Market } from "@/lib/types";
import type { TxFixture } from "./types";
import { matchWinnerStrategy } from "./strategy";

interface DbMarketLite {
  marketPda: string | null;
  question: string;
  yesLabel: string;
  noLabel: string;
  status: string;
  outcome: string | null;
  creator?: string | null;
}

interface OnChainLite {
  yesPool: { toString(): string };
  noPool: { toString(): string };
  settled: boolean;
  outcome: number;
  /** Stored YES-condition — the source of truth for the market's predicate. */
  statKeyA?: number;
  statKeyB?: number;
  threshold?: number;
  comparison?: number;
}

export function fixtureToMarket(
  fx: TxFixture,
  db?: DbMarketLite | null,
  onchain?: OnChainLite | null,
): Market {
  const home = fx.Participant1IsHome ? fx.Participant1 : fx.Participant2;
  const away = fx.Participant1IsHome ? fx.Participant2 : fx.Participant1;
  const kickoffIso = new Date(fx.StartTime).toISOString();
  const strat = matchWinnerStrategy(fx);

  let priceYes = 0.5;
  let totalVolumeUsdc = 0;
  let status = "ACTIVE";
  let finalOutcome: "Yes" | "No" | undefined;

  if (onchain) {
    const yes = Number(onchain.yesPool.toString());
    const no = Number(onchain.noPool.toString());
    const total = yes + no;
    priceYes = total > 0 ? yes / total : 0.5;
    totalVolumeUsdc = total / 1_000_000;
    status = onchain.settled ? "RESOLVED" : "ACTIVE";
    if (onchain.settled) finalOutcome = onchain.outcome === 1 ? "Yes" : "No";
  }

  // Match phase (distinct from on-chain settlement): a market can be unsettled
  // while the match is live or already ended. Cheap heuristic from kickoff time
  // — a soccer match runs ~2.5h incl. stoppage; past that it's "ended" and the
  // auto-settle keeper will flip it to "settled" once the proof lands.
  const kickoffMs = new Date(fx.StartTime).getTime();
  const MATCH_MS = 150 * 60 * 1000;
  const now = Date.now();
  const matchState: "upcoming" | "live" | "ended" | "settled" = onchain?.settled
    ? "settled"
    : now < kickoffMs
      ? "upcoming"
      : now <= kickoffMs + MATCH_MS
        ? "live"
        : "ended";

  return {
    id: fx.FixtureId,
    // Unique route key: several markets can exist on one fixture, so the PDA
    // is the canonical id once created; bare fixtures fall back to fixtureId.
    slug: db?.marketPda ?? String(fx.FixtureId),
    contractAddress: db?.marketPda ?? "",
    marketPda: db?.marketPda ?? null,
    creatorId: "txline",
    creator: {
      id: "txline",
      walletAddr: "TxLINE",
      displayName: "TxLINE",
      avatarColor: "#304FFE",
    },
    question: db?.question ?? `Will ${home} beat ${away}?`,
    questionHash: "",
    category: "sports",
    startTime: kickoffIso,
    endTime: kickoffIso,
    disputeWindowSec: 0,
    lmsrB: 0,
    adapterId: "txline_scores",
    source: "Automated",
    status,
    priceYes,
    priceNo: 1 - priceYes,
    qYes: 0,
    qNo: 0,
    totalVolumeUsdc,
    finalOutcome,
    imageKey: null,
    imageUrl: null,
    yesLabel: db?.yesLabel ?? home,
    noLabel: db?.noLabel ?? away,
    // Real fixture teams — lets the UI show flags even for prop markets
    // whose yes/no labels aren't team names ("2+ goals" / "Under 2").
    home,
    away,
    created: Boolean(db?.marketPda),
    creatorWallet: db?.creator ?? null,
    matchState,
    kickoffMs,
    // Predicate: for a created market, the on-chain account is the truth (it
    // may be a prop market); otherwise default to the match-winner strategy the
    // create button would use.
    statKeyA: onchain ? Number(onchain.statKeyA ?? strat.statKeyA) : strat.statKeyA,
    statKeyB: onchain ? Number(onchain.statKeyB ?? strat.statKeyB) : strat.statKeyB,
    threshold: onchain ? Number(onchain.threshold ?? strat.threshold) : strat.threshold,
    comparison: onchain ? Number(onchain.comparison ?? strat.comparison) : strat.comparison,
  } as unknown as Market;
}

interface DbMarketFull {
  fixtureId: number;
  marketPda: string | null;
  question: string;
  yesLabel: string;
  noLabel: string;
  statKeys: number[];
  creator?: string | null;
  createdAt: Date | string;
}


/**
 * Build a market from a persisted DB row when its fixture is no longer in the
 * live TxLINE snapshot (the free replay tier rotates fixtures out). Without
 * this, a created + settled market — and any claimable position on it — would
 * vanish from the list and its detail page would 404.
 */
export function dbMarketToMarket(
  db: DbMarketFull,
  onchain?: OnChainLite | null,
): Market {
  const home = db.yesLabel;
  const away = db.noLabel;
  const iso = new Date(db.createdAt).toISOString();

  let priceYes = 0.5;
  let totalVolumeUsdc = 0;
  let status = "ACTIVE";
  let finalOutcome: "Yes" | "No" | undefined;
  if (onchain) {
    const yes = Number(onchain.yesPool.toString());
    const no = Number(onchain.noPool.toString());
    const total = yes + no;
    priceYes = total > 0 ? yes / total : 0.5;
    totalVolumeUsdc = total / 1_000_000;
    status = onchain.settled ? "RESOLVED" : "ACTIVE";
    if (onchain.settled) finalOutcome = onchain.outcome === 1 ? "Yes" : "No";
  }
  // Fixture gone from the feed → the match kicked off long ago; if it isn't
  // settled on-chain yet, it has ended and awaits the keeper.
  const matchState: "upcoming" | "live" | "ended" | "settled" = onchain?.settled
    ? "settled"
    : "ended";

  return {
    id: db.fixtureId,
    slug: db.marketPda ?? String(db.fixtureId),
    contractAddress: db.marketPda ?? "",
    marketPda: db.marketPda ?? null,
    creatorId: "txline",
    creator: {
      id: "txline",
      walletAddr: "TxLINE",
      displayName: "TxLINE",
      avatarColor: "#304FFE",
    },
    question: db.question,
    questionHash: "",
    category: "sports",
    startTime: iso,
    endTime: iso,
    disputeWindowSec: 0,
    lmsrB: 0,
    adapterId: "txline_scores",
    source: "Automated",
    status,
    priceYes,
    priceNo: 1 - priceYes,
    qYes: 0,
    qNo: 0,
    totalVolumeUsdc,
    finalOutcome,
    imageKey: null,
    imageUrl: null,
    yesLabel: home,
    noLabel: away,
    created: true,
    creatorWallet: db.creator ?? null,
    matchState,
    kickoffMs: new Date(db.createdAt).getTime(),
    // On-chain account is the predicate's source of truth for created markets.
    statKeyA: Number(onchain?.statKeyA ?? db.statKeys?.[0] ?? 1),
    statKeyB: Number(onchain?.statKeyB ?? db.statKeys?.[1] ?? 2),
    threshold: Number(onchain?.threshold ?? 0),
    comparison: Number(onchain?.comparison ?? 0),
  } as unknown as Market;
}
