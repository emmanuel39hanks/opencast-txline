"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { useMarkets } from "@/lib/hooks/useMarkets";
import { TeamCircle } from "@/components/market/market-card";
import { teamsFromMarket } from "@/lib/teams";
import { formatUsdc } from "@/lib/utils";
import { IconShield, IconArrowRight } from "@/lib/icons";
import { LandingHeader } from "./landing-header";
import type { Market } from "@/lib/types";

/**
 * Hero — full-bleed floodlit stadium running behind the navbar. Centered:
 * one short headline, one line of copy, a search bar, then a row of real
 * bet cards from the board.
 */
export function Hero() {
  const router = useRouter();
  const [query, setQuery] = React.useState("");

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    router.push(q ? `/markets?search=${encodeURIComponent(q)}` : "/markets");
  };

  return (
    <section className="relative w-full overflow-hidden">
      {/* Edge-to-edge stadium photo, behind the navbar too */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/landing/hd-night-pitch.jpg"
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        aria-hidden
      />
      <div className="absolute inset-0 bg-punt-ink/15" />

      <div className="relative mx-auto max-w-[1440px] px-4 sm:px-8">
        <LandingHeader onDark />

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="mx-auto max-w-3xl pt-10 text-center sm:pt-16"
        >
          <h1 className="text-4xl font-black leading-[1.02] tracking-tight text-punt-paper sm:text-6xl">
            Call the game.{" "}
            <span className="relative inline-block whitespace-nowrap">
              The proof pays out.
              <svg
                className="absolute -bottom-1.5 left-0 h-2.5 w-full sm:-bottom-2.5 sm:h-3.5"
                viewBox="0 0 400 16"
                fill="none"
                aria-hidden
              >
                <path
                  d="M3 11 C 80 4, 180 14, 397 6"
                  stroke="#C9F468"
                  strokeWidth="7"
                  strokeLinecap="round"
                  fill="none"
                />
              </svg>
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base font-medium text-punt-paper/70 sm:text-lg">
            Markets on every World Cup match — made by anyone, settled by a
            cryptographic proof of the score.
          </p>

          {/* Search — one white rectangle; Enter submits */}
          <form onSubmit={onSearch} className="relative mx-auto mt-9 max-w-2xl">
            <Search
              className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-punt-ink/40"
              strokeWidth={2.25}
              aria-hidden
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              type="text"
              placeholder="Which match are you looking for?"
              className="h-16 w-full rounded-2xl bg-punt-paper pl-14 pr-5 text-base font-medium text-punt-ink shadow-[0_20px_50px_-25px_rgba(0,0,0,0.7)] placeholder:text-punt-ink/40 focus:outline-none focus:ring-[3px] focus:ring-punt-lime/60"
            />
          </form>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-bold text-punt-paper/55">
            <span className="inline-flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/landing/solana-logo.png" alt="Solana" className="h-3.5 w-3.5" />
              Runs on Solana
            </span>
            <span className="inline-flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/landing/txline-logo-white.svg" alt="TxLINE" className="h-5" />
              Scores proven on-chain
            </span>
            <span>Devnet USDC — free to play</span>
          </div>
        </motion.div>

        {/* Live bet cards */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="pb-16 pt-12 sm:pb-20"
        >
          <div className="mb-3 flex items-center justify-end">
            <Link
              href="/markets"
              className="inline-flex items-center gap-1.5 text-sm font-bold text-punt-paper/70 transition-colors hover:text-punt-paper"
            >
              See all markets
              <IconArrowRight size={14} variant="Linear" color="#C9F468" />
            </Link>
          </div>
          <HeroMarketRow />
        </motion.div>
      </div>
    </section>
  );
}

// ─── Live market cards row ─────────────────────────────────────────────────

const FALLBACKS = [
  { question: "Will England beat Argentina?", home: "England", away: "Argentina", yesLabel: "England", yesPct: 50, volume: 220 },
  { question: "Will England score 2+ goals?", home: "England", away: "Argentina", yesLabel: "2+ goals", yesPct: 36, volume: 363 },
  { question: "Handshake special: England v Argentina ends level?", home: "England", away: "Argentina", yesLabel: "Draw", yesPct: 67, volume: 95 },
  { question: "Will France beat Spain?", home: "France", away: "Spain", yesLabel: "France", yesPct: 42, volume: 240 },
];

function HeroMarketRow() {
  const { data } = useMarkets({});
  const markets = data ?? [];

  // Live/upcoming first, then most-traded — always show four cards.
  const open = markets
    .filter(
      (m) =>
        (m as { marketPda?: string | null }).marketPda && m.status === "ACTIVE",
    )
    .sort((a, b) => {
      const rank = (m: Market) =>
        m.matchState === "live" ? 0 : m.matchState === "upcoming" ? 1 : 2;
      return rank(a) - rank(b) || (b.totalVolumeUsdc ?? 0) - (a.totalVolumeUsdc ?? 0);
    })
    .slice(0, 4);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {open.length
        ? open.map((m) => <HeroCard key={(m as { slug?: string }).slug ?? m.id} market={m} />)
        : FALLBACKS.map((f) => <HeroCard key={f.question} fallback={f} />)}
    </div>
  );
}

function HeroCard({
  market,
  fallback,
}: {
  market?: Market;
  fallback?: (typeof FALLBACKS)[number];
}) {
  const m = market ?? null;
  const teams = m
    ? teamsFromMarket(m)
    : { home: fallback!.home, away: fallback!.away };
  const question = m?.question ?? fallback!.question;
  const yesPct = m ? Math.round((m.priceYes ?? 0.5) * 100) : fallback!.yesPct;
  const yesLabel =
    (m as { yesLabel?: string } | null)?.yesLabel ?? fallback!.yesLabel;
  const volume = m?.totalVolumeUsdc ?? fallback!.volume;
  const live = m?.matchState === "live";
  const href = m
    ? `/markets/${(m as { slug?: string }).slug ?? m.id}`
    : "/markets";

  return (
    <Link
      href={href}
      className="flex flex-col rounded-card bg-punt-paper p-4 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.8)] transition-transform hover:-translate-y-1"
    >
      <div className="flex items-center justify-between gap-2">
        {teams.home && teams.away ? (
          <span className="flex -space-x-2">
            <TeamCircle name={teams.home} size={26} />
            <TeamCircle name={teams.away} size={26} />
          </span>
        ) : (
          <span />
        )}
        {live ? (
          <span className="inline-flex items-center gap-1 rounded-pill bg-rose-500 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-white">
            <span className="h-1 w-1 animate-pulse rounded-full bg-white" />
            Live
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-wider text-punt-ink/40">
            <IconShield size={10} variant="Linear" color="#9A9A95" />
            By proof
          </span>
        )}
      </div>

      <p className="mt-2.5 line-clamp-2 min-h-[2.6em] text-sm font-bold leading-snug text-punt-ink">
        {question}
      </p>

      <div className="mt-3 grid grid-cols-2 gap-1.5">
        <span className="flex items-center justify-between rounded-lg bg-punt-lime-soft px-2.5 py-1.5 text-xs font-bold text-punt-ink">
          <span className="truncate">{yesLabel}</span>
          <span className="ml-1 shrink-0 font-mono">{yesPct}¢</span>
        </span>
        <span className="flex items-center justify-between rounded-lg bg-rose-100 px-2.5 py-1.5 text-xs font-bold text-rose-700">
          <span>No</span>
          <span className="ml-1 shrink-0 font-mono">{100 - yesPct}¢</span>
        </span>
      </div>

      <div className="mt-2.5 text-[10px] font-bold text-punt-ink/45">
        ${formatUsdc(volume)} in the pool
      </div>
    </Link>
  );
}
