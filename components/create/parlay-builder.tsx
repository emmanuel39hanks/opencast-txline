"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useWallet } from "@/lib/wallet";
import { useSettlement } from "@/lib/solana/client";
import { useMarkets } from "@/lib/hooks/useMarkets";
import { BetTypeIcon } from "@/components/market/bet-type-icon";
import { TeamCircle } from "@/components/market/market-card";
import { teamsFromMarket, teamFlagUrl } from "@/lib/teams";
import { cn, formatMoney } from "@/lib/utils";
import { IconShield, IconArrowRight, IconClose } from "@/lib/icons";
import type { Market } from "@/lib/types";

/**
 * A parlay leg is a YES/NO pick on an EXISTING on-chain market, priced by that
 * market's live pool — exactly how Polymarket combos bundle market positions.
 * The predicate (stat keys / threshold / comparison) is read from the market's
 * on-chain account, so settlement proves the same condition traders priced.
 */
interface Leg {
  marketId: number;
  marketPda: string;
  fixtureId: number;
  question: string;
  pickLabel: string;
  home: string;
  away: string;
  betType: string;
  statKeyA: number;
  statKeyB: number;
  threshold: number;
  comparison: number;
  expected: 0 | 1; // 1 = YES side, 0 = NO side
}

const MAX = 8;
const MAX_MULT = 200; // combined-odds cap (treasury cap is the on-chain backstop)

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** Classify a market's stored predicate so legs get the right icon/label. */
function inferBetType(m: {
  statKeyA: number;
  statKeyB: number;
  threshold: number;
  comparison: number;
}): string {
  const base = (k: number) => k % 1000;
  const period = (k: number) => Math.floor(k / 1000);
  if (m.statKeyB !== 0) {
    if (m.comparison === 2) return "draw";
    if (m.threshold === -1) return "double_chance";
    if (m.threshold > 0) return "spread";
    return period(m.statKeyA) === 1 ? "first_half_winner" : "winner";
  }
  const b = base(m.statKeyA);
  if (b <= 2) {
    if (m.comparison === 1) return "clean_sheet";
    return period(m.statKeyA) === 1 ? "first_half_goal" : "goals_over";
  }
  if (b <= 4) return "booking";
  if (b <= 6) return "red_card";
  return "corners_over";
}

export function ParlayBuilder() {
  const router = useRouter();
  const { authenticated, connect, address, usdcBalance, refreshBalance } =
    useWallet();
  const { placeParlay } = useSettlement();
  const { data, isLoading } = useMarkets({}, { refetchInterval: 15_000 });

  const [legs, setLegs] = React.useState<Leg[]>([]);
  const [stake, setStake] = React.useState(5);
  const [busy, setBusy] = React.useState(false);

  // Only live pools qualify: created on-chain, unsettled, and the match hasn't
  // already finished (a finished-but-unsettled market has a known outcome —
  // letting it into a ticket would free-roll the treasury).
  const pickable = React.useMemo(
    () =>
      (data ?? []).filter(
        (m) =>
          (m as { marketPda?: string | null }).marketPda &&
          m.status === "ACTIVE" &&
          (m.matchState === "upcoming" || m.matchState === "live"),
      ),
    [data],
  );

  // Group markets by match so the picker reads like a fixture list, live
  // matches first, then by kickoff.
  const groups = React.useMemo(() => {
    const map = new Map<
      number,
      {
        fixture: number;
        home: string;
        away: string;
        live: boolean;
        kickoffMs: number;
        items: Market[];
      }
    >();
    for (const m of pickable) {
      const existing = map.get(m.id);
      if (existing) {
        existing.items.push(m);
        existing.live = existing.live || m.matchState === "live";
        continue;
      }
      const { home, away } = teamsFromMarket(m);
      map.set(m.id, {
        fixture: m.id,
        home: home ?? "",
        away: away ?? "",
        live: m.matchState === "live",
        kickoffMs:
          (m as { kickoffMs?: number }).kickoffMs ??
          new Date(m.endTime).getTime(),
        items: [m],
      });
    }
    return [...map.values()].sort(
      (a, b) => Number(b.live) - Number(a.live) || a.kickoffMs - b.kickoffMs,
    );
  }, [pickable]);

  /**
   * Odds are LIVE: each leg reprices from its market's current pool every
   * refetch. The payout the user signs is exactly the one shown at click-time
   * (and it's what the program enforces). Returns null once a market is gone
   * (settled / rotated out) — such a leg blocks placing.
   */
  const livePriceOf = React.useCallback(
    (l: Leg): number | null => {
      const m = (data ?? []).find(
        (x) =>
          (x as { marketPda?: string | null }).marketPda === l.marketPda &&
          x.status === "ACTIVE" &&
          (x.matchState === "upcoming" || x.matchState === "live"),
      );
      if (!m) return null;
      const p = clamp(m.priceYes ?? 0.5, 0.02, 0.98);
      return l.expected ? p : 1 - p;
    },
    [data],
  );
  const legPrices = legs.map(livePriceOf);
  const hasStale = legPrices.some((p) => p === null);
  const rawMult = legPrices.reduce((acc: number, p) => acc / (p ?? 1), 1);
  const multiplier = Math.min(MAX_MULT, Math.round(rawMult * 10) / 10);
  const payout = stake * multiplier;

  // The program rejects tickets the treasury can't cover — check up front
  // and cap in the UI instead of letting the transaction bounce.
  const { data: treasury } = useQuery<{ freeUsdc?: number }>({
    queryKey: ["parlay-treasury"],
    staleTime: 30_000,
    refetchInterval: 60_000,
    queryFn: async () => {
      const r = await fetch("/api/parlay/treasury");
      if (!r.ok) return {};
      return (await r.json()) as { freeUsdc?: number };
    },
  });
  const treasuryFree = treasury?.freeUsdc;
  const overTreasury = treasuryFree != null && payout > treasuryFree;

  const inTicket = (pda: string) => legs.some((l) => l.marketPda === pda);

  /**
   * One pick per stat dimension per match. Two legs over the same stat keys
   * are either the same event twice (double payout for one result) or direct
   * contradictions (win + draw, under 2 + score 3+) — both break the
   * independent-odds multiplier, so the second pick is blocked.
   */
  const statSig = (fixtureId: number, a: number, b: number) =>
    `${fixtureId}:${[a, b].sort((x, y) => x - y).join("-")}`;
  const conflictsWithTicket = (m: Market) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mm = m as any;
    if (inTicket(mm.marketPda)) return false; // "already picked" handled separately
    const sig = statSig(m.id, Number(mm.statKeyA), Number(mm.statKeyB));
    return legs.some(
      (l) => statSig(l.fixtureId, l.statKeyA, l.statKeyB) === sig,
    );
  };

  const addLeg = (m: Market, expected: 0 | 1) => {
    const pda = (m as { marketPda?: string }).marketPda;
    if (!pda || legs.length >= MAX || inTicket(pda)) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mm = m as any;
    const { home, away } = teamsFromMarket(m);
    setLegs((l) => [
      ...l,
      {
        marketId: m.id,
        marketPda: mm.marketPda,
        fixtureId: m.id,
        question: m.question,
        pickLabel: expected ? (mm.yesLabel ?? "Yes") : (mm.noLabel ?? "No"),
        home: home ?? mm.yesLabel ?? "",
        away: away ?? mm.noLabel ?? "",
        betType: inferBetType(mm),
        statKeyA: mm.statKeyA,
        statKeyB: mm.statKeyB,
        threshold: mm.threshold,
        comparison: mm.comparison,
        expected,
      },
    ]);
  };

  const removeLeg = (i: number) => setLegs((l) => l.filter((_, x) => x !== i));

  const place = async () => {
    if (legs.length < 2 || stake <= 0) return;
    if (hasStale) {
      toast.error("A pick's market closed — remove it first.");
      return;
    }
    if (!authenticated) return connect();
    setBusy(true);
    try {
      const res = await placeParlay({
        stakeUsdc: stake,
        payoutUsdc: payout,
        legs: legs.map((l) => ({
          fixtureId: l.fixtureId,
          statKeyA: l.statKeyA,
          statKeyB: l.statKeyB,
          threshold: l.threshold,
          comparison: l.comparison,
          expected: l.expected,
        })),
      });
      await fetch("/api/parlay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          betPda: res.bet,
          idSeed: res.id,
          owner: address,
          stake: Math.round(stake * 1e6),
          payout: Math.round(payout * 1e6),
          legs: legs.map((l) => ({
            fixtureId: l.fixtureId,
            marketPda: l.marketPda,
            statKeyA: l.statKeyA,
            statKeyB: l.statKeyB,
            threshold: l.threshold,
            comparison: l.comparison,
            expected: l.expected,
            question: l.question,
            betType: l.betType,
            betTypeLabel: l.question,
            pick: l.pickLabel,
            price: livePriceOf(l),
            home: l.home,
            away: l.away,
          })),
        }),
      });
      toast.success("Parlay placed on-chain");
      setTimeout(refreshBalance, 1500);
      router.push(`/parlay/${res.bet}`);
    } catch (e) {
      toast.error("Couldn't place parlay", {
        description: (e as Error).message.slice(0, 140),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-6 grid gap-5 lg:grid-cols-[1.5fr,1fr]">
      {/* Market picker — grouped by match */}
      <div className="rounded-card border border-punt-ink/8 bg-punt-paper p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-punt-ink/50">
            Pick from open matches
          </span>
          <span className="text-[11px] font-medium text-punt-ink/45">
            priced by each market&apos;s pool
          </span>
        </div>
        <p className="mt-1.5 text-[11px] font-medium leading-relaxed text-punt-ink/45">
          Only matches that haven&apos;t finished can join a ticket — a
          full-time result is already known, so those markets can&apos;t be
          parlayed.
        </p>

        {isLoading ? (
          <div className="mt-4 space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-2xl bg-punt-ink/[0.04]" />
            ))}
          </div>
        ) : groups.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-punt-ink/15 p-8 text-center">
            <p className="text-sm font-bold text-punt-ink">
              No open matches with live markets right now.
            </p>
            <p className="mt-1 text-xs font-medium text-punt-ink/55">
              Markets on finished matches can&apos;t be stacked. Create one on
              an upcoming match and it shows up here instantly.
            </p>
            <Link
              href="/create"
              className="mt-3 inline-block rounded-pill bg-punt-lime px-4 py-2 text-xs font-extrabold text-punt-ink"
            >
              Create a market →
            </Link>
          </div>
        ) : (
          <div className="mt-4 space-y-5">
            {groups.map((g) => (
              <div key={g.fixture}>
                {/* Match header */}
                <div className="flex items-center gap-2.5 px-0.5">
                  {g.home && g.away && (
                    <span className="flex shrink-0 -space-x-1.5">
                      <TeamCircle name={g.home} size={22} />
                      <TeamCircle name={g.away} size={22} />
                    </span>
                  )}
                  <span className="truncate text-sm font-extrabold text-punt-ink">
                    {g.home && g.away ? `${g.home} vs ${g.away}` : "Match"}
                  </span>
                  {g.live ? (
                    <span className="inline-flex items-center gap-1 rounded-pill bg-rose-500 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-white">
                      <span className="h-1 w-1 animate-pulse rounded-full bg-white" />
                      Live
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold text-punt-ink/40">
                      {new Date(g.kickoffMs).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  )}
                  <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-punt-ink/35">
                    {g.items.length} {g.items.length === 1 ? "market" : "markets"}
                  </span>
                </div>

                {/* Markets on this match */}
                <div className="mt-2 space-y-2">
                  {g.items.map((m) => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const mm = m as any;
                    const yesPct = Math.round((m.priceYes ?? 0.5) * 100);
                    const used = inTicket(mm.marketPda);
                    const conflicted = conflictsWithTicket(m);
                    return (
                      <div
                        key={mm.slug ?? mm.marketPda}
                        className={cn(
                          "rounded-2xl border border-punt-ink/8 bg-punt-cream/40 p-3.5 transition-opacity",
                          (used || conflicted) && "opacity-40",
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <BetTypeIcon
                            type={inferBetType(mm)}
                            size={15}
                            className="shrink-0 text-punt-ink/70"
                          />
                          <span className="truncate text-sm font-bold text-punt-ink">
                            {m.question}
                          </span>
                          {conflicted && (
                            <span className="ml-auto shrink-0 rounded-pill bg-amber-100 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-amber-700">
                              Overlaps a pick
                            </span>
                          )}
                        </div>
                        <div className="mt-2.5 grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            disabled={used || conflicted || legs.length >= MAX}
                            onClick={() => addLeg(m, 1)}
                            className="flex items-center justify-between rounded-xl bg-punt-lime-soft px-3 py-2 text-sm font-bold text-punt-ink transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                          >
                            <span className="truncate">{mm.yesLabel ?? "Yes"}</span>
                            <span className="shrink-0 font-mono">{yesPct}¢</span>
                          </button>
                          <button
                            type="button"
                            disabled={used || conflicted || legs.length >= MAX}
                            onClick={() => addLeg(m, 0)}
                            className="flex items-center justify-between rounded-xl bg-rose-100 px-3 py-2 text-sm font-bold text-rose-700 transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                          >
                            <span className="truncate">{mm.noLabel ?? "No"}</span>
                            <span className="shrink-0 font-mono">{100 - yesPct}¢</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Ticket */}
      <div className="h-fit rounded-card border border-punt-ink/8 bg-punt-paper p-5 lg:sticky lg:top-24">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-punt-ink/50">
            Your ticket ({legs.length}/{MAX})
          </span>
          {legs.length > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-pill bg-punt-ink px-2.5 py-1 font-mono text-[12px] font-black text-punt-lime">
              {multiplier}×
              {rawMult > MAX_MULT && (
                <span className="text-[9px] font-bold uppercase tracking-wide text-punt-paper/60">
                  capped
                </span>
              )}
            </span>
          )}
        </div>

        {legs.length === 0 ? (
          <p className="mt-4 rounded-2xl bg-punt-cream/50 p-5 text-center text-xs font-medium leading-relaxed text-punt-ink/55">
            Tap a side on any market to add it. Two or more picks make a parlay —
            all of them must hit.
          </p>
        ) : (
          <>
            <div className="mt-3 space-y-2">
              {legs.map((l, i) => (
                <div
                  key={l.marketPda}
                  className="flex items-center gap-2.5 rounded-2xl bg-punt-cream/50 px-3 py-2.5"
                >
                  <BetTypeIcon type={l.betType} size={15} className="shrink-0 text-punt-ink/70" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          "rounded-pill px-1.5 py-0.5 text-[9px] font-extrabold uppercase",
                          l.expected
                            ? "bg-punt-lime text-punt-ink"
                            : "bg-rose-100 text-rose-600",
                        )}
                      >
                        {l.expected ? "Yes" : "No"}
                      </span>
                      <span className="truncate text-[13px] font-bold text-punt-ink">
                        {l.pickLabel}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-1 truncate text-[11px] font-medium text-punt-ink/50">
                      <Flag name={l.home} />
                      {l.question}
                    </div>
                  </div>
                  <span className="shrink-0 font-mono text-xs font-bold text-punt-ink/60">
                    {legPrices[i] === null ? "closed" : `${Math.round((legPrices[i] as number) * 100)}¢`}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeLeg(i)}
                    className="grid h-6 w-6 shrink-0 place-items-center rounded-pill text-punt-ink/40 hover:bg-punt-ink/5 hover:text-punt-ink"
                    aria-label="Remove pick"
                  >
                    <IconClose size={13} variant="Linear" />
                  </button>
                </div>
              ))}
            </div>

            {/* Stake */}
            <div className="mt-4 rounded-2xl bg-punt-cream/60 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-punt-ink/50">
                  Stake
                </span>
                <div className="flex items-center gap-1 font-mono text-2xl font-black text-punt-ink">
                  <span className="text-punt-ink/40">$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={stake}
                    onChange={(e) => {
                      const n = Number(e.target.value.replace(/[^0-9.]/g, ""));
                      setStake(Number.isFinite(n) ? Math.max(0, n) : 0);
                    }}
                    style={{ width: `${Math.max(1, String(stake).length)}ch` }}
                    className="bg-transparent text-right outline-none"
                  />
                </div>
              </div>
              <div className="mt-2 flex gap-1.5">
                {[1, 5, 10, 25].map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setStake(a)}
                    className={cn(
                      "h-8 flex-1 rounded-pill border text-xs font-bold transition-colors",
                      stake === a
                        ? "border-punt-ink bg-punt-ink text-punt-paper"
                        : "border-punt-ink/10 bg-punt-paper text-punt-ink/70 hover:bg-punt-ink/5",
                    )}
                  >
                    ${a}
                  </button>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-punt-ink/8 pt-3">
                <span className="text-sm font-bold text-punt-ink/60">
                  To win if all {legs.length} hit
                </span>
                <span className="font-mono text-lg font-black text-punt-ink">
                  ${formatMoney(payout)}
                </span>
              </div>
            </div>

            {overTreasury && (
              <div className="mt-3 rounded-2xl bg-amber-50 px-3.5 py-2.5 text-[11px] font-medium leading-relaxed text-amber-800">
                <span className="font-bold">
                  The treasury can cover up to ${formatMoney(treasuryFree!)}
                </span>{" "}
                right now — lower your stake or drop a pick so the payout fits.
              </div>
            )}

            <button
              type="button"
              onClick={place}
              disabled={
                busy || legs.length < 2 || stake <= 0 || hasStale || overTreasury
              }
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-pill bg-punt-lime py-3.5 text-base font-extrabold text-punt-ink transition-transform hover:-translate-y-0.5 disabled:opacity-50"
            >
              {busy
                ? "Placing on-chain…"
                : hasStale
                  ? "Remove closed picks"
                  : overTreasury
                    ? "Payout exceeds treasury"
                    : legs.length < 2
                      ? "Add at least 2 picks"
                      : authenticated
                        ? `Place $${stake} parlay`
                        : "Connect wallet to place"}
              <IconArrowRight size={16} variant="Linear" color="#0A0A0A" />
            </button>

            <div className="mt-3 flex items-start gap-2 text-[11px] font-medium leading-relaxed text-punt-ink/45">
              <IconShield size={12} variant="Linear" color="#0A0A0A" className="mt-0.5 shrink-0" />
              <span>
                Odds track the live pools and reprice until you place; the payout you sign is the payout enforced on-chain. Every pick is proven
                on-chain against its own TxLINE proof and AND-ed — miss one and
                the ticket loses. Winners are paid from the treasury.
              </span>
            </div>
            {authenticated && (
              <div className="mt-2 text-center text-[11px] font-medium text-punt-ink/45">
                Balance ${formatMoney(usdcBalance)}
              </div>
            )}
            <div className="mt-2 text-center text-[10px] font-medium leading-relaxed text-punt-ink/35">
              The wallet popup approves the transaction — its &quot;fee&quot; is
              Solana network gas (≈ $0 on devnet) and the small dollar figure is
              your SOL gas balance. Your stake is the USDC above.
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Flag({ name }: { name: string }) {
  const flag = teamFlagUrl(name);
  if (!flag) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={flag} alt="" className="h-3.5 w-3.5 shrink-0 rounded-full object-cover" />
  );
}
