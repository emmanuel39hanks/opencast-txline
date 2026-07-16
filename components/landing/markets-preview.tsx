"use client";

import Link from "next/link";
import { useFeaturedMarkets } from "@/lib/hooks/useMarkets";
import type { Market, MarketCategory } from "@/lib/types";
import {
  IconCrypto,
  IconSports,
  IconWeather,
  IconNews,
  IconPolitics,
  IconEntertainment,
  IconTrendUp,
  IconArrowRight,
} from "@/lib/icons";
import { SectionHeading } from "./how-it-works";
import { TeamCircle } from "@/components/market/market-card";
import { teamsFromMarket } from "@/lib/teams";

/**
 * Polymarket-style "All markets" preview. Pulls live featured markets from
 * the backend and renders them as Punt-styled tiles with Iconsax category
 * indicators (no emoji).
 */
export function MarketsPreview() {
  const { data, isLoading } = useFeaturedMarkets(6);
  const markets = data ?? [];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <SectionHeading
          eyebrow="Live now"
          title="The board, right now."
          subtitle="Real markets with real pools — created by users, priced by the crowd, settled by proof."
        />
        <Link
          href="/markets"
          className="rounded-pill bg-punt-ink px-5 py-2.5 text-sm font-bold text-punt-paper transition-transform hover:-translate-y-0.5"
        >
          Browse all →
        </Link>
      </div>

      <CategoryRow />

      {isLoading ? (
        <SkeletonGrid />
      ) : markets.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {markets.map((m) => (
            <MarketTile key={(m as { slug?: string }).slug ?? m.id} market={m} />
          ))}
        </div>
      )}
    </div>
  );
}

const CATEGORIES: { label: string; value: MarketCategory | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Crypto", value: "crypto" },
  { label: "Sports", value: "sports" },
  { label: "Weather", value: "weather" },
  { label: "News", value: "news" },
  { label: "Politics", value: "politics" },
  { label: "Entertainment", value: "entertainment" },
];

function CategoryRow() {
  return (
    <div className="mt-2 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
      {CATEGORIES.map((c, i) => (
        <Link
          key={c.value}
          href={c.value === "all" ? "/markets" : `/markets?category=${c.value}`}
          className={`shrink-0 rounded-pill border px-4 py-2 text-sm font-bold transition-colors ${
            i === 0
              ? "border-transparent bg-punt-ink text-punt-paper"
              : "border-transparent text-punt-ink/55 hover:bg-punt-ink/5 hover:text-punt-ink"
          }`}
        >
          {c.label}
        </Link>
      ))}
    </div>
  );
}

function MarketTile({ market }: { market: Market }) {
  const yesPct = Math.round((market.priceYes ?? 0) * 100);
  const noPct = 100 - yesPct;
  const volLabel = formatVolume(market.totalVolumeUsdc ?? 0);
  const Icon = iconFor(market.category);
  const { home, away } = teamsFromMarket(market);

  return (
    <Link
      href={`/markets/${(market as { slug?: string }).slug ?? market.id}`}
      className="group flex h-[230px] flex-col rounded-3xl border border-punt-ink/8 bg-punt-paper p-5 transition-transform hover:-translate-y-1 hover:border-punt-ink/15"
    >
      <div className="flex items-start gap-3">
        {home && away ? (
          <span className="flex shrink-0 -space-x-2.5 pt-0.5">
            <TeamCircle name={home} size={36} />
            <TeamCircle name={away} size={36} />
          </span>
        ) : (
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-punt-ink/5 text-punt-ink">
            <Icon size={22} variant="Linear" color="#0A0A0A" />
          </div>
        )}
        <p className="line-clamp-2 text-base font-bold leading-snug text-punt-ink">
          {market.question}
        </p>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="font-mono text-punt-ink/50">
          {formatDate(market.endTime)}
        </span>
        <span className="text-base font-black text-punt-ink">{yesPct}%</span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <span className="rounded-xl bg-punt-lime-soft px-3 py-2 text-center text-sm font-bold text-punt-ink">
          Yes {yesPct}%
        </span>
        <span className="rounded-xl bg-rose-100 px-3 py-2 text-center text-sm font-bold text-rose-700">
          No {noPct}%
        </span>
      </div>

      <div className="mt-auto flex items-center justify-between pt-3 text-xs font-bold text-punt-ink/55">
        <span>${volLabel} traded</span>
        <span className="inline-flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          Open <IconArrowRight size={12} variant="Linear" color="#0A0A0A" />
        </span>
      </div>
    </Link>
  );
}

function SkeletonGrid() {
  return (
    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="h-[230px] animate-pulse rounded-3xl border border-punt-ink/8 bg-punt-ink/[0.03]"
        />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mt-6 flex flex-col items-center gap-3 rounded-3xl border border-dashed border-punt-ink/15 bg-punt-cream/30 p-12 text-center">
      <IconTrendUp size={36} variant="Linear" color="#0A0A0A" />
      <p className="text-base font-bold text-punt-ink">
        No live markets yet — be the first to ship one.
      </p>
      <Link
        href="/create"
        className="mt-2 rounded-pill bg-punt-lime px-5 py-2.5 text-sm font-extrabold text-punt-ink transition-transform hover:-translate-y-0.5"
      >
        Create a market →
      </Link>
    </div>
  );
}

function iconFor(cat: MarketCategory): React.ElementType {
  switch (cat) {
    case "crypto":
      return IconCrypto;
    case "sports":
      return IconSports;
    case "weather":
      return IconWeather;
    case "news":
      return IconNews;
    case "politics":
      return IconPolitics;
    case "entertainment":
      return IconEntertainment;
    default:
      return IconTrendUp;
  }
}

function formatVolume(input: number | string | null | undefined): string {
  // `totalVolumeUsdc` is a Prisma Decimal that the API serialises as a
  // string. Coerce defensively so v.toFixed() doesn't blow up.
  const v = typeof input === "number" ? input : Number(input ?? 0);
  if (!Number.isFinite(v)) return "0";
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return v.toFixed(0);
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return "—";
  }
}
