"use client";

import * as React from "react";
import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useMyPositions } from "@/lib/hooks/useClaim";
import { useMarkets } from "@/lib/hooks/useMarkets";
import { useWallet } from "@/lib/wallet";
import { useSettlement } from "@/lib/solana/client";
import { MarketStatusBadge } from "@/components/market/market-status-badge";
import { TeamCircle } from "@/components/market/market-card";
import {
  IconTrendUp,
  IconWallet,
  IconArrowRight,
} from "@/lib/icons";
import { cn, formatPercent, formatMoney, formatUsdc } from "@/lib/utils";

/**
 * /portfolio — your predictions, claimable winnings, markets you created.
 *
 * Layout (Polymarket-inspired, Punt language):
 *  - "Portfolio" hero + 4-cell summary strip (Value / Cash / P&L / Claimable)
 *  - Tab pills (Positions / Parlays / Claimable / History / My markets)
 *  - Positions as a real table: MARKET · STAKE · NOW · TO WIN · VALUE · P&L,
 *    one row per side held, with a Claim button on winning rows.
 */
export default function PortfolioPage() {
  const { authenticated, connecting, address, usdcBalance } = useWallet();
  const { login } = usePrivy();

  // Session still hydrating — never flash the signed-out state on refresh.
  if (connecting) return <AuthRestoring />;
  if (!authenticated) {
    return <SignInPanel onSignIn={login} />;
  }

  return <PortfolioInner address={address} usdcBalance={usdcBalance} />;
}

function AuthRestoring() {
  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 sm:py-8">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-44 animate-pulse rounded-card bg-punt-ink/[0.04]" />
        <div className="h-44 animate-pulse rounded-card bg-punt-ink/[0.04]" />
      </div>
      <div className="mt-8 h-64 animate-pulse rounded-card bg-punt-ink/[0.04]" />
    </div>
  );
}

// ─── Anonymous panel ──────────────────────────────────────────────────────

function SignInPanel({ onSignIn }: { onSignIn: () => void }) {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-20 sm:py-28">
      <div className="rounded-card border border-punt-ink/8 bg-punt-paper p-10 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-pill bg-punt-lime">
          <IconWallet size={24} variant="Linear" color="#0A0A0A" />
        </div>
        <h1 className="mt-6 text-2xl font-bold tracking-tight text-punt-ink sm:text-3xl">
          Sign in to see your predictions
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm font-medium text-punt-ink/60">
          Your open positions, parlays, claimable winnings, and the markets
          you've created — all on one page.
        </p>
        <button
          type="button"
          onClick={onSignIn}
          className="mt-7 rounded-pill bg-punt-ink px-7 py-3 text-base font-extrabold text-punt-paper transition-transform hover:-translate-y-0.5"
        >
          Connect Wallet
        </button>
      </div>
    </div>
  );
}

// ─── Position shape (API: /api/portfolio/[wallet]) ────────────────────────

type Pos = {
  marketId: number;
  marketPda?: string | null;
  market: {
    id: number;
    question: string;
    status: string;
    priceYes: number;
    endTime: string;
    finalOutcome?: "Yes" | "No";
  };
  yesShares: number;
  noShares: number;
  costBasis: number;
  currentValue: number;
  pnl: number;
  claimable: boolean;
  claimableAmount: number;
  settledPayout?: number | null;
  claimed?: boolean;
  toWinYes?: number;
  toWinNo?: number;
  yesLabel?: string | null;
  noLabel?: string | null;
  home?: string;
  away?: string;
  settled?: boolean;
};

/** One table row = one side of a position. */
type Row = {
  key: string;
  pos: Pos;
  side: "yes" | "no";
  label: string;
  stake: number;
  nowPct: number;
  toWin: number;
  /** settled only — did this side win? */
  won?: boolean;
};

function rowsOf(positions: Pos[]): Row[] {
  const rows: Row[] = [];
  for (const p of positions) {
    const settled = Boolean(p.settled);
    const outcome = p.market.finalOutcome;
    if (p.yesShares > 0) {
      rows.push({
        key: `${p.marketPda ?? p.marketId}-yes`,
        pos: p,
        side: "yes",
        label: p.yesLabel ?? "Yes",
        stake: p.yesShares,
        nowPct: Math.round((p.market.priceYes ?? 0.5) * 100),
        toWin: p.toWinYes ?? 0,
        won: settled ? outcome === "Yes" : undefined,
      });
    }
    if (p.noShares > 0) {
      rows.push({
        key: `${p.marketPda ?? p.marketId}-no`,
        pos: p,
        side: "no",
        label: p.noLabel ?? "No",
        stake: p.noShares,
        nowPct: Math.round((1 - (p.market.priceYes ?? 0.5)) * 100),
        toWin: p.toWinNo ?? 0,
        won: settled ? outcome === "No" : undefined,
      });
    }
  }
  return rows;
}

// ─── Parlay ticket shape (API: /api/parlay?owner=) ─────────────────────────

type ParlayTicket = {
  betPda: string;
  stake: number;
  payout: number;
  legs: Array<{ pick?: string; question?: string; expected?: number }>;
  createdAt: string;
  chain: {
    evaluated: number;
    passed: number;
    settled: boolean;
    won: boolean;
    claimed: boolean;
  } | null;
};

function useMyParlays(address: string | null) {
  return useQuery<ParlayTicket[]>({
    queryKey: ["parlays", address],
    enabled: !!address,
    staleTime: 10_000,
    queryFn: async () => {
      const r = await fetch(`/api/parlay?owner=${address}`);
      if (!r.ok) return [];
      const j = (await r.json()) as { tickets?: ParlayTicket[] };
      return j.tickets ?? [];
    },
  });
}

// ─── Authed view ──────────────────────────────────────────────────────────

type Tab = "positions" | "parlays" | "claimable" | "history" | "my-markets";

function PortfolioInner({
  address,
  usdcBalance,
}: {
  address: string | null;
  usdcBalance: number;
}) {
  const [tab, setTab] = React.useState<Tab>("positions");

  const portfolio = useMyPositions();
  const parlays = useMyParlays(address);
  const myMarkets = useMarkets(
    {},
    { creator: address ?? undefined, enabled: true },
  );
  const parlayTickets = parlays.data ?? [];

  const positions = (portfolio.data ?? []) as unknown as Pos[];
  // Open predictions stay front and center; settled ones (won, lost, claimed)
  // move to History so the Positions tab always means "money in play".
  const open = positions.filter((p) => !p.settled);
  const history = positions.filter((p) => p.settled);
  const claimable = positions.filter((p) => p.claimable);
  const myMarketsData = myMarkets.data ?? [];

  // Aggregate stats
  const portfolioValue = positions.reduce(
    (acc, p) => acc + (p.currentValue ?? 0),
    0,
  );
  const totalPnl = positions.reduce((acc, p) => acc + (p.pnl ?? 0), 0);
  const claimableTotal = claimable.reduce(
    (acc, p) => acc + (p.claimableAmount ?? 0),
    0,
  );

  const [query, setQuery] = React.useState("");
  const q = query.trim().toLowerCase();
  const searched = (list: Pos[]) =>
    q ? list.filter((p) => p.market.question.toLowerCase().includes(q)) : list;

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 sm:py-8">
      {/* ── Header: Portfolio card + P/L chart (Polymarket layout) ───── */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Portfolio */}
        <div className="flex flex-col rounded-card border border-punt-ink/8 bg-punt-paper p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-punt-ink/45">
                Portfolio
              </div>
              <div className="mt-1 text-4xl font-black tracking-tight tabular-nums text-punt-ink">
                ${formatMoney(portfolioValue)}
              </div>
              <div
                className={cn(
                  "mt-1.5 text-xs font-bold",
                  totalPnl > 0
                    ? "text-emerald-600"
                    : totalPnl < 0
                      ? "text-rose-600"
                      : "text-punt-ink/45",
                )}
              >
                {totalPnl >= 0 ? "+" : "−"}${formatMoney(Math.abs(totalPnl))}{" "}
                all-time
              </div>
            </div>
            <div className="text-right">
              <div className="text-[11px] font-bold uppercase tracking-wider text-punt-ink/45">
                Available to trade
              </div>
              <div className="mt-1 text-xl font-extrabold tabular-nums text-punt-ink">
                ${formatMoney(usdcBalance)}
              </div>
            </div>
          </div>
          <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">
            <Link
              href="/settings#faucet"
              className="rounded-pill bg-punt-lime px-5 py-2.5 text-sm font-extrabold text-punt-ink transition-transform hover:-translate-y-0.5"
            >
              Mint USDC
            </Link>
            <Link
              href="/markets"
              className="rounded-pill border border-punt-ink/15 bg-punt-paper px-5 py-2.5 text-sm font-bold text-punt-ink transition-colors hover:bg-punt-ink/5"
            >
              Browse markets
            </Link>
            {claimableTotal > 0 && (
              <button
                type="button"
                onClick={() => setTab("claimable")}
                className="ml-auto rounded-pill bg-emerald-50 px-4 py-2.5 text-sm font-extrabold text-emerald-700 transition-colors hover:bg-emerald-100"
              >
                Claim ${formatMoney(claimableTotal)} →
              </button>
            )}
          </div>
        </div>

        {/* Profit / Loss */}
        <PnlCard positions={positions} totalPnl={totalPnl} />
      </div>

      {/* ── Tabs + search ─────────────────────────────────────────────── */}
      <div className="mt-8 flex flex-wrap items-center gap-2">
        <TabPill
          active={tab === "positions"}
          onClick={() => setTab("positions")}
          label="Positions"
          count={open.length}
        />
        <TabPill
          active={tab === "parlays"}
          onClick={() => setTab("parlays")}
          label="Parlays"
          count={parlayTickets.length}
        />
        <TabPill
          active={tab === "claimable"}
          onClick={() => setTab("claimable")}
          label="Claimable"
          count={claimable.length}
          dot={claimable.length > 0}
        />
        <TabPill
          active={tab === "history"}
          onClick={() => setTab("history")}
          label="History"
          count={history.length}
        />
        <TabPill
          active={tab === "my-markets"}
          onClick={() => setTab("my-markets")}
          label="My markets"
          count={myMarketsData.length}
        />
        {(tab === "positions" || tab === "claimable") && (
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search positions…"
            className="ml-auto h-10 w-full max-w-[220px] rounded-pill border border-punt-ink/[0.08] bg-punt-paper px-4 text-sm font-medium text-punt-ink placeholder:text-punt-ink/40 focus:border-punt-ink/20 focus:outline-none focus:ring-2 focus:ring-punt-lime/40"
          />
        )}
      </div>

      <div className="mt-5">
        {tab === "positions" && (
          <PositionsTable
            positions={searched(open)}
            isLoading={portfolio.isLoading}
            isError={portfolio.isError}
            onRetry={portfolio.refetch}
            emptyTitle="No open positions."
            emptyBody="Settled predictions live in History. Pick a market and get back in."
          />
        )}
        {tab === "history" && (
          <PositionsTable
            positions={searched(history)}
            emptyTitle="Nothing settled yet."
            emptyBody="Once a market you predicted on resolves, it moves here — wins, losses, and claims."
          />
        )}
        {tab === "parlays" && (
          <ParlaysList tickets={parlayTickets} isLoading={parlays.isLoading} />
        )}
        {tab === "claimable" && (
          <PositionsTable
            positions={searched(claimable)}
            emptyTitle="Nothing to claim right now."
            emptyBody="When a market you predicted on resolves in your favour, your winnings appear here."
          />
        )}
        {tab === "my-markets" && (
          <MyMarketsList markets={myMarketsData} isLoading={myMarkets.isLoading} />
        )}
      </div>
    </div>
  );
}

// ─── P/L chart card ────────────────────────────────────────────────────────

const PNL_RANGES = [
  { key: "1W", ms: 7 * 86_400_000 },
  { key: "1M", ms: 30 * 86_400_000 },
  { key: "All", ms: Infinity },
] as const;

function PnlCard({
  positions,
  totalPnl,
}: {
  positions: Pos[];
  totalPnl: number;
}) {
  const [range, setRange] =
    React.useState<(typeof PNL_RANGES)[number]["key"]>("All");

  // Cumulative realized P/L over settled positions (by match end time),
  // closing at today's total — real numbers, no synthetic walk.
  const series = React.useMemo(() => {
    const settled = positions
      .filter((p) => p.settled)
      .sort(
        (a, b) =>
          new Date(a.market.endTime).getTime() -
          new Date(b.market.endTime).getTime(),
      );
    let acc = 0;
    const pts = settled.map((p) => {
      acc += p.pnl;
      return { t: new Date(p.market.endTime).getTime(), v: acc };
    });
    const now = Date.now();
    const start = pts.length ? pts[0].t - 86_400_000 : now - 7 * 86_400_000;
    const all = [{ t: start, v: 0 }, ...pts, { t: now, v: totalPnl }];
    const win = PNL_RANGES.find((r) => r.key === range)!.ms;
    const cutoff = now - win;
    const inWin = all.filter((p) => p.t >= cutoff);
    return inWin.length >= 2 ? inWin : all.slice(-2);
  }, [positions, totalPnl, range]);

  const up = totalPnl >= 0;
  const stroke = up ? "#059669" : "#E11D48";

  return (
    <div className="flex flex-col rounded-card border border-punt-ink/8 bg-punt-paper p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-punt-ink/45">
            Profit / Loss
          </div>
          <div
            className={cn(
              "mt-1 text-3xl font-black tracking-tight tabular-nums",
              up ? "text-emerald-600" : "text-rose-600",
            )}
          >
            {up ? "+" : "−"}${formatMoney(Math.abs(totalPnl))}
          </div>
        </div>
        <div className="flex items-center gap-0.5 rounded-pill bg-punt-cream/70 p-0.5">
          {PNL_RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setRange(r.key)}
              className={cn(
                "rounded-pill px-2.5 py-1 text-[11px] font-bold transition-colors",
                range === r.key
                  ? "bg-punt-ink text-punt-paper"
                  : "text-punt-ink/50 hover:text-punt-ink",
              )}
            >
              {r.key}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-3 h-[104px] flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={series}
            margin={{ top: 4, right: 0, bottom: 0, left: 0 }}
          >
            <defs>
              <linearGradient id="pnlFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={stroke} stopOpacity={0.22} />
                <stop offset="100%" stopColor={stroke} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="t"
              type="number"
              domain={["dataMin", "dataMax"]}
              hide
            />
            <YAxis hide domain={["auto", "auto"]} />
            <ChartTooltip
              cursor={{ stroke: "#0A0A0A", strokeOpacity: 0.15 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as { t: number; v: number };
                return (
                  <div className="rounded-xl border border-punt-ink/10 bg-punt-paper px-3 py-1.5 text-xs font-bold shadow-sm">
                    <span className={p.v >= 0 ? "text-emerald-600" : "text-rose-600"}>
                      {p.v >= 0 ? "+" : "−"}${formatMoney(Math.abs(p.v))}
                    </span>
                    <span className="ml-2 text-punt-ink/45">
                      {new Date(p.t).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                );
              }}
            />
            <Area
              type="monotone"
              dataKey="v"
              stroke={stroke}
              strokeWidth={2}
              fill="url(#pnlFill)"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Tab pill ─────────────────────────────────────────────────────────────

function TabPill({
  active,
  onClick,
  label,
  count,
  dot,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
  dot?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-pill px-4 py-2.5 text-sm font-bold transition-colors",
        active
          ? "bg-punt-ink text-punt-paper"
          : "bg-transparent text-punt-ink/60 hover:bg-punt-ink/5 hover:text-punt-ink",
      )}
    >
      {label}
      {typeof count === "number" && (
        <span
          className={cn(
            "rounded-pill px-2 py-0.5 text-[10px] tabular-nums",
            active ? "bg-punt-paper/15" : "bg-punt-ink/5 text-punt-ink/60",
          )}
        >
          {count}
        </span>
      )}
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-punt-lime" />}
    </button>
  );
}

// ─── Positions table (Polymarket-style) ───────────────────────────────────

function PositionsTable({
  positions,
  isLoading,
  isError,
  onRetry,
  emptyTitle = "No positions yet.",
  emptyBody = "Pick a market and make your first prediction.",
}: {
  positions: Pos[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyBody?: string;
}) {
  if (isLoading) return <ListSkeleton />;
  if (isError)
    return (
      <EmptyPanel
        title="Couldn't load your positions"
        cta={onRetry ? { label: "Retry", onClick: onRetry } : undefined}
      />
    );

  const rows = rowsOf(positions);
  if (rows.length === 0)
    return (
      <EmptyPanel
        title={emptyTitle}
        body={emptyBody}
        cta={{ label: "Browse markets", href: "/markets" }}
      />
    );

  return (
    <div className="overflow-x-auto rounded-card border border-punt-ink/8 bg-punt-paper">
      <table className="w-full min-w-[720px] border-collapse text-left">
        <thead>
          <tr className="border-b border-punt-ink/8">
            <Th className="pl-5">Market</Th>
            <Th align="right">Stake</Th>
            <Th align="right">Now</Th>
            <Th align="right">To win</Th>
            <Th align="right">Value</Th>
            <Th align="right">P&amp;L</Th>
            <Th align="right" className="pr-5">
              <span className="sr-only">Action</span>
            </Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <PositionTr key={r.key} row={r} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({
  children,
  align,
  className,
}: {
  children?: React.ReactNode;
  align?: "right";
  className?: string;
}) {
  return (
    <th
      className={cn(
        "whitespace-nowrap px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-punt-ink/45",
        align === "right" && "text-right",
        className,
      )}
    >
      {children}
    </th>
  );
}

function PositionTr({ row }: { row: Row }) {
  const { pos, side, label, stake, nowPct, toWin, won } = row;
  const settled = Boolean(pos.settled);
  const payout = pos.settledPayout ?? pos.currentValue;

  // Per-side value + P&L: open predictions are marked at stake (parimutuel —
  // you can't sell out); settled ones at actual payout (0 once claimed — the
  // money lives in cash then — and 0 when the side lost). P&L stays
  // realized either way.
  const value = settled ? (won ? (pos.claimed ? 0 : payout) : 0) : stake;
  const pnl = settled ? (won ? payout - stake : -stake) : 0;

  return (
    <tr className="border-b border-punt-ink/[0.05] transition-colors last:border-0 hover:bg-punt-ink/[0.02]">
      {/* Market */}
      <td className="max-w-[380px] py-3.5 pl-5 pr-3">
        <Link
          href={`/markets/${pos.marketPda ?? pos.marketId}`}
          className="group flex items-center gap-3"
        >
          {pos.home && pos.away ? (
            <span className="flex shrink-0 -space-x-2">
              <TeamCircle name={pos.home} size={28} />
              <TeamCircle name={pos.away} size={28} />
            </span>
          ) : (
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-punt-ink/5">
              <IconTrendUp size={13} variant="Linear" color="#0A0A0A" />
            </span>
          )}
          <span className="min-w-0">
            <span className="line-clamp-1 text-sm font-bold text-punt-ink group-hover:opacity-70">
              {pos.market.question}
            </span>
            <span className="mt-1 flex items-center gap-1.5">
              <span
                className={cn(
                  "rounded-pill px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide",
                  side === "yes"
                    ? "bg-punt-lime-soft text-punt-ink"
                    : "bg-rose-100 text-rose-700",
                )}
              >
                {side === "yes" ? "Yes" : "No"}
                {label && label !== "Yes" && label !== "No" ? ` · ${label}` : ""}
              </span>
              {pos.yesShares > 0 && pos.noShares > 0 && (
                <span
                  className="rounded-pill bg-amber-100 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-amber-700"
                  title="You hold both sides of this market — one row per side. Both can't win, so the 2% fee is a locked-in loss."
                >
                  Hedged
                </span>
              )}
            </span>
          </span>
        </Link>
      </td>

      {/* Stake */}
      <Td>${formatMoney(stake)}</Td>

      {/* Now (current implied odds for this side) */}
      <Td muted={settled}>{settled ? "—" : `${nowPct}%`}</Td>

      {/* To win */}
      <Td tone={!settled ? "lime" : undefined} muted={settled && !won}>
        {settled
          ? won
            ? `$${formatMoney(payout)}`
            : "—"
          : `$${formatMoney(toWin)}`}
      </Td>

      {/* Value */}
      <Td>${formatMoney(value)}</Td>

      {/* P&L */}
      <Td
        tone={settled ? (pnl >= 0 ? "lime" : "rose") : undefined}
        muted={!settled}
      >
        {settled
          ? `${pnl >= 0 ? "+" : "−"}$${formatMoney(Math.abs(pnl))}`
          : "—"}
      </Td>

      {/* Action */}
      <td className="whitespace-nowrap py-3.5 pl-3 pr-5 text-right">
        <RowAction row={row} />
      </td>
    </tr>
  );
}

function Td({
  children,
  tone,
  muted,
}: {
  children: React.ReactNode;
  tone?: "lime" | "rose";
  muted?: boolean;
}) {
  return (
    <td
      className={cn(
        "whitespace-nowrap px-3 py-3.5 text-right font-mono text-sm font-extrabold tabular-nums",
        tone === "lime"
          ? "text-emerald-700"
          : tone === "rose"
            ? "text-rose-700"
            : muted
              ? "text-punt-ink/35"
              : "text-punt-ink",
      )}
    >
      {children}
    </td>
  );
}

function RowAction({ row }: { row: Row }) {
  const { pos, won } = row;
  const { claim } = useSettlement();
  const qc = useQueryClient();
  const [claiming, setClaiming] = React.useState(false);
  const settled = Boolean(pos.settled);

  const onClaim = async () => {
    if (!pos.marketPda) {
      toast.error("Market address missing — refresh and try again");
      return;
    }
    setClaiming(true);
    try {
      await claim({ market: pos.marketPda });
      toast.success("Winnings claimed");
      await new Promise((r) => setTimeout(r, 2500));
      qc.invalidateQueries({ queryKey: ["portfolio"] });
    } catch (e) {
      toast.error((e as Error).message.slice(0, 120));
    } finally {
      setClaiming(false);
    }
  };

  if (settled && won && pos.claimable) {
    return (
      <button
        type="button"
        onClick={onClaim}
        disabled={claiming}
        className="rounded-pill bg-punt-lime px-3.5 py-1.5 text-xs font-extrabold text-punt-ink transition-transform hover:-translate-y-0.5 disabled:opacity-50"
      >
        {claiming ? "Claiming…" : `Claim $${formatMoney(pos.claimableAmount)}`}
      </button>
    );
  }
  if (settled && won) {
    return (
      <span className="rounded-pill bg-punt-ink/5 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-punt-ink/50">
        Claimed
      </span>
    );
  }
  if (settled) {
    return (
      <span className="rounded-pill bg-rose-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-rose-500">
        Lost
      </span>
    );
  }
  return (
    <span className="rounded-pill bg-punt-cream px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-punt-ink/50">
      Open
    </span>
  );
}

// ─── Parlays ──────────────────────────────────────────────────────────────

function ParlaysList({
  tickets,
  isLoading,
}: {
  tickets: ParlayTicket[];
  isLoading: boolean;
}) {
  if (isLoading) return <ListSkeleton />;
  if (tickets.length === 0)
    return (
      <EmptyPanel
        title="No parlays yet."
        body="Stack two or more picks from open matches into one ticket — all of them must hit."
        cta={{ label: "Build a parlay", href: "/parlays/new" }}
      />
    );

  // Live tickets on top; settled ones sink below a divider.
  const openTickets = tickets.filter((t) => !t.chain?.settled);
  const doneTickets = tickets.filter((t) => t.chain?.settled);

  return (
    <div className="space-y-3">
      {[...openTickets, ...doneTickets].map((t, i) => {
        const firstDone = doneTickets.length > 0 && i === openTickets.length;
        const legs = Array.isArray(t.legs) ? t.legs : [];
        const mult = t.stake > 0 ? Math.round((t.payout / t.stake) * 10) / 10 : 0;
        const status = !t.chain
          ? { label: "Open", cls: "bg-punt-cream text-punt-ink/60" }
          : t.chain.claimed
            ? { label: "Claimed", cls: "bg-punt-ink/5 text-punt-ink/50" }
            : t.chain.settled && t.chain.won
              ? { label: "Won — claim", cls: "bg-punt-lime text-punt-ink" }
              : t.chain.settled
                ? { label: "Lost", cls: "bg-rose-50 text-rose-500" }
                : { label: `${countBits(t.chain.evaluated)}/${legs.length} proven`, cls: "bg-punt-cream text-punt-ink/60" };
        return (
          <React.Fragment key={t.betPda}>
          {firstDone && (
            <div className="pt-3 text-[11px] font-bold uppercase tracking-wider text-punt-ink/40">
              Finished tickets
            </div>
          )}
          <Link
            href={`/parlay/${t.betPda}`}
            className={cn(
              "flex flex-wrap items-center gap-4 rounded-3xl border border-punt-ink/8 bg-punt-paper p-5 transition-colors hover:border-punt-ink/15",
              t.chain?.settled && "opacity-75",
            )}
          >
            <div className="min-w-0 flex-1">
              <p className="line-clamp-1 text-base font-bold text-punt-ink">
                {legs.length}-leg parlay
                <span className="ml-2 rounded-pill bg-punt-ink px-2 py-0.5 font-mono text-[11px] font-black text-punt-lime">
                  {mult}×
                </span>
              </p>
              <p className="mt-1 line-clamp-1 text-xs font-medium text-punt-ink/55">
                {legs
                  .map((l) => l.pick ?? l.question ?? "pick")
                  .slice(0, 4)
                  .join(" · ")}
                {legs.length > 4 ? ` · +${legs.length - 4} more` : ""}
              </p>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-bold uppercase tracking-wider text-punt-ink/45">
                Stake → payout
              </div>
              <div className="font-mono text-sm font-extrabold tabular-nums text-punt-ink">
                ${formatMoney(t.stake)} → ${formatMoney(t.payout)}
              </div>
            </div>
            <span
              className={cn(
                "rounded-pill px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider",
                status.cls,
              )}
            >
              {status.label}
            </span>
          </Link>
          </React.Fragment>
        );
      })}
    </div>
  );
}

/** Number of set bits — proven legs live in an on-chain bitmask. */
function countBits(n: number): number {
  let c = 0;
  let v = n >>> 0;
  while (v) {
    c += v & 1;
    v >>>= 1;
  }
  return c;
}

// ─── My markets ───────────────────────────────────────────────────────────

function MyMarketsList({
  markets,
  isLoading,
}: {
  markets: import("@/lib/types").Market[];
  isLoading: boolean;
}) {
  if (isLoading) return <ListSkeleton />;
  if (markets.length === 0)
    return (
      <EmptyPanel
        title="You haven't created a market yet."
        body="Markets you create earn you fees on every trade."
        cta={{ label: "Create your first market", href: "/create" }}
      />
    );

  return (
    <div className="space-y-3">
      {markets.map((m) => (
        <div
          key={(m as unknown as { slug?: string }).slug ?? m.id}
          className="flex flex-wrap items-center gap-4 rounded-3xl border border-punt-ink/8 bg-punt-paper p-5"
        >
          <Link
            href={`/markets/${(m as unknown as { slug?: string }).slug ?? m.id}`}
            className="min-w-0 flex-1"
          >
            <p className="line-clamp-1 text-base font-bold text-punt-ink hover:opacity-70">
              {m.question}
            </p>
            <div className="mt-2 flex items-center gap-2 text-xs">
              <MarketStatusBadge status={m.status} />
              <span className="rounded-pill bg-punt-ink/5 px-2.5 py-0.5 font-bold text-punt-ink/65">
                ${formatUsdc(m.totalVolumeUsdc)} traded
              </span>
              <span className="rounded-pill bg-punt-lime-soft px-2.5 py-0.5 font-bold text-punt-ink">
                Yes {formatPercent(m.priceYes, 0)}
              </span>
            </div>
          </Link>
          <Link
            href={`/verify/${m.id}${m.contractAddress ? `?m=${m.contractAddress}` : ""}`}
            className="rounded-pill border border-punt-ink/15 bg-punt-paper px-4 py-2.5 text-sm font-bold text-punt-ink transition-transform hover:-translate-y-0.5"
          >
            {m.status === "RESOLVED" ? "View receipt" : "View proof"}
          </Link>
        </div>
      ))}
    </div>
  );
}

// ─── Generic state panels ─────────────────────────────────────────────────

function EmptyPanel({
  title,
  body,
  cta,
}: {
  title: string;
  body?: string;
  cta?: { label: string; href?: string; onClick?: () => void };
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-punt-ink/15 bg-punt-paper p-12 text-center">
      <IconTrendUp size={32} variant="Linear" color="#0A0A0A" />
      <p className="text-base font-bold text-punt-ink">{title}</p>
      {body && (
        <p className="max-w-sm text-sm font-medium text-punt-ink/55">{body}</p>
      )}
      {cta && (
        <CtaButton {...cta} />
      )}
    </div>
  );
}

function CtaButton({
  label,
  href,
  onClick,
}: {
  label: string;
  href?: string;
  onClick?: () => void;
}) {
  const className =
    "mt-2 inline-flex items-center gap-1.5 rounded-pill bg-punt-lime px-5 py-2.5 text-sm font-extrabold text-punt-ink transition-transform hover:-translate-y-0.5";
  if (href)
    return (
      <Link href={href} className={className}>
        {label}
        <IconArrowRight size={14} variant="Linear" color="#0A0A0A" />
      </Link>
    );
  return (
    <button type="button" onClick={onClick} className={className}>
      {label}
    </button>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="h-24 animate-pulse rounded-3xl border border-punt-ink/8 bg-punt-ink/[0.03]"
        />
      ))}
    </div>
  );
}
