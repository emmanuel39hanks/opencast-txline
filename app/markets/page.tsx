"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { MarketCard, MatchPhaseBadge } from "@/components/market/market-card";
import { teamsFromMarket, teamFlagUrl } from "@/lib/teams";
import { useMarkets } from "@/lib/hooks/useMarkets";
import type {
  MarketCategory,
  MarketFilters,
  Market,
} from "@/lib/types";
import {
  IconTrendUp,
  IconArrowRight,
  IconStar,
  IconFlash,
} from "@/lib/icons";
import { formatUsdc } from "@/lib/utils";
import { OddsSparkline } from "@/components/market/odds-chart";
import { ValueStrip } from "@/components/markets/value-strip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * /markets — Polymarket-style hub in Punt language.
 *
 * Layout:
 *  - Category pill bar (URL-synced)
 *  - Featured market hero (top market by volume)
 *  - Sub-bar: status + sort filters + result count
 *  - Market grid
 *
 * Suspense wrapper: useSearchParams() requires a Suspense boundary in Next 15,
 * otherwise the static prerender pass aborts. The page body lives in an
 * inner component so the boundary can be the page-level shell.
 */
export default function MarketsPage() {
  return (
    <React.Suspense fallback={<MarketsPageSkeleton />}>
      <MarketsPageInner />
    </React.Suspense>
  );
}

function MarketsPageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-8 sm:px-6">
      <div className="h-8 w-40 animate-pulse rounded-pill bg-punt-ink/5" />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-[230px] animate-pulse rounded-3xl bg-punt-ink/5" />
        ))}
      </div>
    </div>
  );
}

function MarketsPageInner() {
  const params = useSearchParams();

  const [filters, setFilters] = React.useState<MarketFilters>(() => ({
    status: "all",
    category: (params.get("category") as MarketCategory) ?? "all",
    sort: "volume",
    search: params.get("search") ?? "",
  }));

  // Sync URL search/category back into filter state when the AppHeader
  // search bar or category nav pushes a new URL.
  React.useEffect(() => {
    setFilters((f) => ({
      ...f,
      category: (params.get("category") as MarketCategory) ?? "all",
      search: params.get("search") ?? "",
    }));
  }, [params]);

  const { data, isLoading, isError, refetch } = useMarkets(filters);
  const markets = data ?? [];

  // Pick the featured hero (only when category is "all" and there's no
  // search — otherwise the grid dominates). listMarkets ranks live →
  // upcoming → settled → awaiting-proof, so the first entry is already the
  // most compelling market on the board.
  const isUnfiltered =
    filters.category === "all" && (filters.search ?? "").length === 0;
  const featured = isUnfiltered ? markets[0] : undefined;
  const slugOf = (m: Market) => (m as { slug?: string }).slug ?? String(m.id);
  const rest = featured
    ? markets.filter((m) => slugOf(m) !== slugOf(featured))
    : markets;
  const liveCount = markets.filter((m) => m.matchState === "live").length;
  const openCount = markets.filter((m) => m.matchState !== "settled").length;

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 sm:py-8">
      {/* Featured hero */}
      {isUnfiltered && featured && (
        <FeaturedHero market={featured} />
      )}

      {/* Sub-bar */}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-punt-ink sm:text-2xl">
            {filters.search
              ? `Results for “${filters.search}”`
              : filters.category && filters.category !== "all"
                ? capitalise(filters.category)
                : "All markets"}
          </h2>
          <p className="mt-0.5 text-xs font-medium text-punt-ink/55">
            {isLoading
              ? "Loading…"
              : `${markets.length} ${markets.length === 1 ? "market" : "markets"}` +
                (liveCount ? ` · ${liveCount} live` : "") +
                (openCount === 0 ? " · all settled" : "")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/parlays/new"
            className="inline-flex items-center gap-1.5 rounded-pill bg-punt-ink px-4 py-2 text-sm font-extrabold text-punt-paper transition-transform hover:-translate-y-0.5"
          >
            <IconFlash size={14} variant="Bold" color="#C9F468" />
            Build a parlay
          </Link>
          <FilterSelect
            value={filters.status ?? "all"}
            onChange={(v) =>
              setFilters((f) => ({ ...f, status: v as MarketFilters["status"] }))
            }
            options={[
              { label: "All statuses", value: "all" },
              { label: "Open", value: "open" },
              { label: "Awaiting proof", value: "ended" },
              { label: "Settled", value: "settled" },
            ]}
          />
          <FilterSelect
            value={filters.sort ?? "volume"}
            onChange={(v) =>
              setFilters((f) => ({ ...f, sort: v as MarketFilters["sort"] }))
            }
            options={[
              { label: "Top volume", value: "volume" },
              { label: "Newest", value: "newest" },
              { label: "Ending soon", value: "ending_soon" },
            ]}
          />
        </div>
      </div>

      {/* Grid */}
      {isError ? (
        <ErrorPanel onRetry={refetch} />
      ) : isLoading ? (
        <GridSkeleton />
      ) : rest.length === 0 ? (
        <EmptyPanel
          hasSearch={Boolean(filters.search)}
          category={filters.category ?? "all"}
        />
      ) : (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {rest.map((m) => (
            <MarketCard key={(m as {slug?: string}).slug ?? m.id} market={m} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Featured hero card ────────────────────────────────────────────────────

function FeaturedHero({ market }: { market: Market }) {
  const yesPct = Math.round((market.priceYes ?? 0) * 100);
  const noPct = 100 - yesPct;
  const { home, away } = teamsFromMarket(market);
  const homeFlag = teamFlagUrl(home);
  const awayFlag = teamFlagUrl(away);
  const phase =
    market.matchState ?? (market.status === "RESOLVED" ? "settled" : "upcoming");
  return (
    <div className="mt-5 grid gap-4 lg:grid-cols-[1.6fr,1fr]">
      {/* Left — featured market card (single Link) */}
      <Link
        href={`/markets/${(market as { slug?: string }).slug ?? market.id}`}
        className="group relative flex flex-col overflow-hidden rounded-2xl border border-punt-ink/8 bg-punt-paper p-5 transition-all hover:border-punt-ink/15 hover:shadow-[0_10px_40px_-20px_rgba(10,10,10,0.35)]"
      >
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-pill bg-punt-ink px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-punt-paper">
            <IconStar size={10} variant="Linear" color="#C9F468" />
            Featured
          </span>
          {market.category && (
            <span className="rounded-pill bg-teal-100 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-teal-700">
              {market.category}
            </span>
          )}
          <span className="ml-auto">
            <MatchPhaseBadge phase={phase} />
          </span>
        </div>

        {/* Teams + question */}
        <div className="mt-4 flex items-center gap-3">
          {homeFlag && awayFlag && (
            <div className="flex shrink-0 -space-x-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={homeFlag} alt={home} className="h-11 w-11 rounded-full border-2 border-punt-paper object-cover" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={awayFlag} alt={away} className="h-11 w-11 rounded-full border-2 border-punt-paper object-cover" />
            </div>
          )}
          <h2 className="line-clamp-2 text-xl font-black leading-[1.15] tracking-tight text-punt-ink sm:text-2xl">
            {market.question}
          </h2>
        </div>

        {/* Odds curve */}
        <div className="mt-4 rounded-2xl bg-gradient-to-b from-punt-cream/50 to-transparent px-1 pt-2">
          <div className="mb-1 flex items-center justify-between px-2 text-[10px] font-extrabold uppercase tracking-wider text-punt-ink/50">
            <span>{yesLabelOfFeatured(market)} · {yesPct}%</span>
            <span className="inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              live pool
            </span>
          </div>
          <OddsSparkline market={market} height={88} />
        </div>

        {/* Yes / No */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <span className="flex items-center justify-between rounded-xl bg-punt-lime-soft px-4 py-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-punt-ink/60">Yes</span>
            <span className="text-lg font-black tabular-nums text-punt-ink">{yesPct}¢</span>
          </span>
          <span className="flex items-center justify-between rounded-xl bg-rose-50 px-4 py-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-punt-ink/60">No</span>
            <span className="text-lg font-black tabular-nums text-punt-ink">{noPct}¢</span>
          </span>
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-2 pt-4 text-xs font-bold text-punt-ink/55">
          <span className="rounded-pill bg-punt-ink/5 px-2.5 py-1">
            ${formatUsdc(market.totalVolumeUsdc)} in pool
          </span>
          <span className="ml-auto inline-flex items-center gap-1 text-punt-ink">
            Trade <IconArrowRight size={12} variant="Linear" color="#0A0A0A" />
          </span>
        </div>
      </Link>

      {/* Right — value props (each card is its own Link) */}
      <ValueStrip />
    </div>
  );
}

function yesLabelOfFeatured(m: Market): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (m as any).yesLabel ?? "Yes";
}

// ─── Filter dropdown ───────────────────────────────────────────────────────

function FilterSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { label: string; value: string }[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-auto min-w-[130px] gap-1.5 rounded-pill border-transparent bg-punt-cream/70 px-3.5 text-[13px] font-bold text-punt-ink/80 transition-colors hover:bg-punt-cream data-[state=open]:bg-punt-cream">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="rounded-2xl border-punt-ink/10 bg-punt-paper">
        {options.map((opt) => (
          <SelectItem
            key={opt.value}
            value={opt.value}
            className="rounded-xl text-sm font-bold"
          >
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ─── States ────────────────────────────────────────────────────────────────

function GridSkeleton() {
  return (
    <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="h-[230px] animate-pulse rounded-3xl border border-punt-ink/8 bg-punt-ink/[0.03]"
        />
      ))}
    </div>
  );
}

function EmptyPanel({
  hasSearch,
  category,
}: {
  hasSearch: boolean;
  category: string;
}) {
  // Only sports markets exist during the World Cup — other categories are
  // announced in the nav but land here until they open.
  const comingSoon = !hasSearch && category !== "all" && category !== "sports";
  if (comingSoon) {
    return (
      <div className="mt-8 flex flex-col items-center gap-3 rounded-3xl border border-dashed border-punt-ink/15 bg-punt-paper p-12 text-center">
        <span className="rounded-pill bg-punt-lime px-3 py-1 text-[11px] font-black uppercase tracking-wider text-punt-ink">
          Coming soon
        </span>
        <p className="text-base font-bold text-punt-ink">
          {capitalise(category)} markets are on the way.
        </p>
        <p className="max-w-sm text-sm font-medium text-punt-ink/55">
          OpenCast launched with World Cup soccer — same provable settlement,
          new data sources next.
        </p>
        <Link
          href="/markets"
          className="mt-2 rounded-pill bg-punt-ink px-5 py-2.5 text-sm font-extrabold text-punt-paper transition-transform hover:-translate-y-0.5"
        >
          Back to live markets →
        </Link>
      </div>
    );
  }
  return (
    <div className="mt-8 flex flex-col items-center gap-3 rounded-3xl border border-dashed border-punt-ink/15 bg-punt-paper p-12 text-center">
      <IconTrendUp size={40} variant="Linear" color="#0A0A0A" />
      <p className="text-base font-bold text-punt-ink">
        {hasSearch
          ? "No markets match that search yet."
          : "No markets in this category yet."}
      </p>
      <Link
        href="/create"
        className="mt-2 rounded-pill bg-punt-lime px-5 py-2.5 text-sm font-extrabold text-punt-ink transition-transform hover:-translate-y-0.5"
      >
        Create one →
      </Link>
    </div>
  );
}

function ErrorPanel({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="mt-8 flex flex-col items-center gap-3 rounded-3xl border border-dashed border-rose-200 bg-rose-50 p-12 text-center">
      <p className="text-base font-bold text-rose-700">
        Couldn't reach the backend.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-pill bg-punt-ink px-4 py-2 text-sm font-bold text-punt-paper"
      >
        Retry
      </button>
    </div>
  );
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
