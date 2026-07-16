import Link from "next/link";
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
import { cn, formatCountdown, formatUsdc } from "@/lib/utils";
import { yesLabelOf } from "@/lib/labels";
import { teamsFromMarket, teamFlagUrl } from "@/lib/teams";
import type { Market, MarketCategory } from "@/lib/types";

/**
 * Market card — clean, Polymarket-style, in the Punt language.
 *
 *   [flags/icon]  CATEGORY            [phase]
 *   Question (2 lines)
 *   [ YES label  ·  % ]   [ NO label  ·  % ]
 *   $vol traded                         Open →
 */
export function MarketCard({
  market,
  compact = false,
}: {
  market: Market;
  compact?: boolean;
}) {
  const yesPct = Math.round((market.priceYes ?? 0) * 100);
  const noPct = 100 - yesPct;
  const Icon = iconFor(market.category);
  const phase: "upcoming" | "live" | "ended" | "settled" =
    market.matchState ?? (market.status === "RESOLVED" ? "settled" : "upcoming");
  const resolvedYes = market.finalOutcome === "Yes";
  const resolvedNo = market.finalOutcome === "No";
  const created = Boolean((market as { marketPda?: string | null }).marketPda);

  const { home, away } = teamsFromMarket(market);
  const showTeams = market.category === "sports" && home && away;
  const kickoffDate = new Date(market.kickoffMs ?? market.endTime);

  return (
    <Link
      href={`/markets/${(market as { slug?: string }).slug ?? market.id}`}
      className="group flex h-full min-h-[220px] flex-col rounded-2xl border border-punt-ink/8 bg-punt-paper p-4 transition-all hover:-translate-y-0.5 hover:border-punt-ink/15 hover:shadow-[0_6px_24px_-12px_rgba(10,10,10,0.25)]"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          {showTeams ? (
            <div className="flex shrink-0 -space-x-2.5">
              <TeamCircle name={home!} />
              <TeamCircle name={away!} />
            </div>
          ) : market.imageUrl ? (
            <div className="h-9 w-9 shrink-0 overflow-hidden rounded-xl bg-punt-ink/5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={market.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
            </div>
          ) : (
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-punt-ink/5 text-punt-ink">
              <Icon size={18} variant="Linear" color="#0A0A0A" />
            </div>
          )}
          {market.category && (
            <span
              className={cn(
                "rounded-pill px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider",
                CATEGORY_TINT[market.category] ?? "bg-punt-ink/5 text-punt-ink/65",
              )}
            >
              {market.category}
            </span>
          )}
        </div>
        <MatchPhaseBadge phase={phase} />
      </div>

      {/* Question */}
      <h3
        className={cn(
          "mt-3 line-clamp-2 font-bold leading-snug text-punt-ink",
          compact ? "text-sm" : "text-[15px]",
        )}
      >
        {market.question}
      </h3>

      {/* Split probability bar */}
      <div className="mt-3 flex items-center gap-2">
        <div className="flex h-1.5 flex-1 overflow-hidden rounded-pill bg-punt-cream">
          <div className="h-full bg-punt-lime" style={{ width: `${yesPct}%` }} />
          <div className="h-full bg-rose-300" style={{ width: `${noPct}%` }} />
        </div>
        <span className="font-mono text-xs font-black tabular-nums text-punt-ink">
          {yesPct}%
        </span>
      </div>

      {/* Outcome pills */}
      <div className="mt-2.5 grid grid-cols-2 gap-2">
        <span
          className={cn(
            "flex items-center justify-between gap-1 rounded-xl px-2.5 py-2 text-sm font-bold",
            resolvedNo
              ? "bg-punt-cream/60 text-punt-ink/40"
              : "bg-punt-lime-soft text-punt-ink",
          )}
        >
          <span className="truncate">{yesLabelOf(market) ?? "Yes"}</span>
          <span className="shrink-0 tabular-nums">{yesPct}%</span>
        </span>
        <span
          className={cn(
            "flex items-center justify-between gap-1 rounded-xl px-2.5 py-2 text-sm font-bold",
            resolvedYes ? "bg-punt-cream/60 text-punt-ink/40" : "bg-rose-100 text-rose-700",
          )}
        >
          <span className="truncate">No</span>
          <span className="shrink-0 tabular-nums">{noPct}%</span>
        </span>
      </div>

      {/* Footer */}
      <div className="mt-auto flex items-center justify-between pt-3.5 text-xs font-bold text-punt-ink/50">
        <span className="inline-flex items-center gap-1.5">
          {created ? (
            <>
              <IconTrendUp size={12} variant="Linear" color="#9A9A95" />
              ${formatUsdc(market.totalVolumeUsdc)}
            </>
          ) : (
            <span className="rounded-pill bg-punt-lime-soft px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-punt-ink/70">
              New
            </span>
          )}
          <span className="text-punt-ink/25">·</span>
          <span className="font-mono font-medium text-punt-ink/45">
            {phase === "live"
              ? "In progress"
              : phase === "upcoming"
                ? formatCountdown(market.kickoffMs ?? market.endTime)
                : kickoffDate.toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
          </span>
        </span>
        <span className="inline-flex items-center gap-1 text-punt-ink opacity-0 transition-opacity group-hover:opacity-100">
          Open
          <IconArrowRight size={12} variant="Linear" color="#0A0A0A" />
        </span>
      </div>
    </Link>
  );
}

/**
 * Team avatar — country flag when we can resolve one, otherwise a clean
 * two-letter monogram (never raw label text like "2+").
 */
export function TeamCircle({
  name,
  size = 36,
}: {
  name: string;
  size?: number;
}) {
  const flag = teamFlagUrl(name);
  if (flag) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={flag}
        alt={name}
        title={name}
        style={{ width: size, height: size }}
        className="rounded-full border-2 border-punt-paper bg-punt-ink/5 object-cover"
        loading="lazy"
      />
    );
  }
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .replace(/[^a-zA-Z]/g, "")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span
      style={{ width: size, height: size }}
      title={name}
      className="grid place-items-center rounded-full border-2 border-punt-paper bg-punt-ink text-[10px] font-extrabold tracking-wide text-punt-paper"
    >
      {initials || "?"}
    </span>
  );
}

/** Match phase pill — live (pulsing), upcoming, ended (awaiting proof), or settled. */
export function MatchPhaseBadge({
  phase,
}: {
  phase: "upcoming" | "live" | "ended" | "settled";
}) {
  if (phase === "live") {
    return (
      <span className="inline-flex items-center gap-1 rounded-pill bg-rose-500 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
        Live
      </span>
    );
  }
  if (phase === "settled") {
    return (
      <span className="rounded-pill bg-punt-ink px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-punt-paper">
        Settled
      </span>
    );
  }
  if (phase === "ended") {
    return (
      <span className="rounded-pill bg-amber-100 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-amber-700">
        Full-time
      </span>
    );
  }
  return (
    <span className="rounded-pill bg-punt-ink/8 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-punt-ink/60">
      Upcoming
    </span>
  );
}

const CATEGORY_TINT: Partial<Record<MarketCategory, string>> = {
  crypto: "bg-amber-100 text-amber-700",
  sports: "bg-teal-100 text-teal-700",
  weather: "bg-sky-100 text-sky-700",
  news: "bg-slate-100 text-slate-700",
  politics: "bg-rose-100 text-rose-700",
  entertainment: "bg-pink-100 text-pink-700",
};

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
