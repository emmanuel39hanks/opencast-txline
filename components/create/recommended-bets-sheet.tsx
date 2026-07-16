"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { IconMagic, IconArrowRight, IconClose } from "@/lib/icons";
import { useMarkets } from "@/lib/hooks/useMarkets";
import { teamsFromMarket, teamFlagUrl } from "@/lib/teams";
import { MatchPhaseBadge } from "@/components/market/market-card";
import { cn, formatUsdc } from "@/lib/utils";
import type { Market } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Fired when the user picks a match — passes its question to the drafter. */
  onPick: (question: string) => void;
}

type Tab = "all" | "live" | "upcoming";
const TABS: { label: string; value: Tab }[] = [
  { label: "All", value: "all" },
  { label: "Live", value: "live" },
  { label: "Upcoming", value: "upcoming" },
];

/**
 * Recommended-bets bottom sheet — live World Cup matches from TxLINE. Tap one
 * and we prefill the question + draft it. Same drawer UX as the original, now
 * fed by the real fixture feed instead of static templates.
 */
export function RecommendedBetsSheet({ open, onOpenChange, onPick }: Props) {
  const [tab, setTab] = React.useState<Tab>("all");
  const { data, isLoading } = useMarkets({}, { enabled: open });

  const markets = (data ?? []).filter((m) => m.category === "sports");
  const phaseOf = (m: Market) =>
    m.matchState ?? (m.status === "RESOLVED" ? "settled" : "upcoming");
  const shown =
    tab === "all"
      ? markets
      : markets.filter((m) => phaseOf(m) === tab);
  const count = (v: Tab) =>
    v === "all" ? markets.length : markets.filter((m) => phaseOf(m) === v).length;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-punt-ink/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed inset-x-2 bottom-2 z-50 max-h-[85vh] overflow-hidden rounded-[32px] bg-punt-cream shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom data-[state=open]:duration-300 sm:inset-x-4 sm:bottom-4">
          <div className="mx-auto flex max-h-[85vh] w-full max-w-[1080px] flex-col">
            <div className="flex justify-center pt-3">
              <span className="h-1.5 w-12 rounded-pill bg-punt-ink/15" />
            </div>

            {/* Header */}
            <div className="flex shrink-0 items-start justify-between gap-4 px-6 pt-5 sm:px-8">
              <div>
                <span className="punt-sticker -rotate-2 border-punt-ink/80 bg-punt-paper text-punt-ink">
                  <IconMagic size={11} variant="Linear" color="#0A0A0A" />
                  Recommended
                </span>
                <h2 className="mt-3 text-2xl font-bold tracking-tight text-punt-ink sm:text-3xl">
                  Skip the typing.
                </h2>
                <p className="mt-1 text-sm font-medium text-punt-ink/55">
                  Pick a World Cup match — we prefill the question and draft it.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                aria-label="Close"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-pill border border-punt-ink/10 bg-punt-paper text-punt-ink/65 transition-colors hover:bg-punt-ink/5"
              >
                <IconClose size={16} variant="Linear" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex shrink-0 gap-2 overflow-x-auto px-6 pt-5 no-scrollbar sm:px-8">
              {TABS.map((t) => {
                const active = tab === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setTab(t.value)}
                    className={cn(
                      "inline-flex shrink-0 items-center gap-2 rounded-pill px-4 py-2 text-sm font-bold transition-colors",
                      active
                        ? "bg-punt-ink text-punt-paper"
                        : "bg-transparent text-punt-ink/60 hover:bg-punt-ink/5 hover:text-punt-ink",
                    )}
                  >
                    {t.label}
                    <span
                      className={cn(
                        "rounded-pill px-1.5 py-0.5 text-[10px] tabular-nums",
                        active ? "bg-punt-paper/15" : "bg-punt-ink/5 text-punt-ink/60",
                      )}
                    >
                      {count(t.value)}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Grid */}
            <div className="flex-1 overflow-y-auto px-6 pb-8 pt-5 sm:px-8">
              {isLoading ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-32 animate-pulse rounded-2xl bg-punt-ink/[0.04]" />
                  ))}
                </div>
              ) : shown.length === 0 ? (
                <p className="py-10 text-center text-sm font-medium text-punt-ink/50">
                  No matches here right now.
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {shown.map((m) => (
                    <MatchCard
                      key={(m as { slug?: string }).slug ?? m.id}
                      market={m}
                      phase={phaseOf(m)}
                      onPick={(q) => {
                        onPick(q);
                        onOpenChange(false);
                      }}
                    />
                  ))}
                </div>
              )}
              <p className="mt-6 text-center text-[11px] font-medium text-punt-ink/45">
                Don&apos;t see one you like? Just type your own question above.
              </p>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** Provable prop-bet suggestions for a fixture — one tap each drafts it. */
function propBets(home: string, away: string) {
  return [
    { label: "Winner", q: `Will ${home} beat ${away}?` },
    { label: "Clean sheet", q: `${home} to keep a clean sheet vs ${away}` },
    { label: "2+ goals", q: `${home} to score 2+ goals vs ${away}` },
    { label: "Corners", q: `${home} to win 5+ corners vs ${away}` },
    { label: "Red card", q: `Will ${away} get a red card vs ${home}?` },
    { label: "Half-time lead", q: `${home} to lead at half-time vs ${away}` },
  ];
}

function MatchCard({
  market,
  phase,
  onPick,
}: {
  market: Market;
  phase: "upcoming" | "live" | "ended" | "settled";
  onPick: (question: string) => void;
}) {
  const { home, away } = teamsFromMarket(market);
  const homeFlag = teamFlagUrl(home);
  const awayFlag = teamFlagUrl(away);
  const props = home && away ? propBets(home, away) : [];
  return (
    <div className="group flex h-full flex-col gap-3 rounded-2xl bg-punt-paper p-5 text-left">
      <div className="flex w-full items-center justify-between">
        <div className="flex -space-x-2">
          {[homeFlag, awayFlag].map((f, i) =>
            f ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={f}
                alt=""
                className="h-8 w-8 rounded-full border-2 border-punt-paper bg-punt-ink/5 object-cover"
              />
            ) : (
              <span
                key={i}
                className="grid h-8 w-8 place-items-center rounded-full border-2 border-punt-paper bg-punt-ink/10 text-[10px] font-black text-punt-ink/50"
              >
                {(i === 0 ? home : away)?.slice(0, 2).toUpperCase()}
              </span>
            ),
          )}
        </div>
        <MatchPhaseBadge phase={phase} />
      </div>

      <button
        type="button"
        onClick={() => onPick(market.question)}
        className="text-left text-base font-bold leading-snug text-punt-ink transition-colors hover:text-punt-ink/70"
      >
        {home && away ? `${home} vs ${away}` : market.question}
      </button>

      {/* Provable prop-bet quick picks */}
      {props.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {props.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => onPick(p.q)}
              className="rounded-pill border border-punt-ink/10 bg-punt-cream/60 px-2.5 py-1 text-[11px] font-bold text-punt-ink/70 transition-colors hover:border-punt-ink/25 hover:bg-punt-lime-soft hover:text-punt-ink"
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => onPick(market.question)}
        className="mt-auto inline-flex items-center gap-1 self-start text-xs font-bold text-punt-ink transition-colors hover:text-punt-ink/70"
      >
        Draft the winner
        <IconArrowRight
          size={14}
          variant="Linear"
          color="#0A0A0A"
          className="transition-transform group-hover:translate-x-0.5"
        />
      </button>
    </div>
  );
}
