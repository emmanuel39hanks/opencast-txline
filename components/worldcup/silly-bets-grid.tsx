"use client";

import * as React from "react";
import Link from "next/link";
import { WORLDCUP_BETS, type WorldCupTone } from "@/lib/worldcup-data";
import { IconArrowRight, IconFlash } from "@/lib/icons";
import { cn } from "@/lib/utils";

const TONE_TABS: { label: string; value: WorldCupTone | "all" }[] = [
  { label: "All predictions", value: "all" },
  { label: "Big calls", value: "serious" },
  { label: "Silly predictions", value: "silly" },
];

/**
 * The fun centerpiece of /worldcup — a 4-column grid of curated prediction
 * cards in mixed tints. Filter pill row lets you switch between Big
 * questions and silly predictions.
 */
export function SillyBetsGrid() {
  const [tab, setTab] = React.useState<WorldCupTone | "all">("all");
  const bets = WORLDCUP_BETS.filter((b) => tab === "all" || b.tone === tab);

  return (
    <section id="silly-predictions" className="py-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="punt-sticker -rotate-2 border-punt-ink/80 bg-punt-paper text-punt-ink">
            <IconFlash size={12} variant="Linear" color="#0A0A0A" />
            104 matches · 1 trophy
          </span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-punt-ink sm:text-4xl">
            Predict the chaos.
          </h2>
          <p className="mt-2 max-w-lg text-sm font-medium text-punt-ink/60">
            From the Cup itself to "will any keeper score a goal." Click a
            card to make the call — settles when the match settles.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {TONE_TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTab(t.value)}
              className={cn(
                "rounded-pill px-4 py-2 text-sm font-bold transition-colors",
                tab === t.value
                  ? "bg-punt-ink text-punt-paper"
                  : "bg-transparent text-punt-ink/60 hover:bg-punt-ink/5 hover:text-punt-ink",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {bets.map((b) => (
          <BetCard key={b.id} bet={b} />
        ))}
      </div>
    </section>
  );
}

function BetCard({ bet }: { bet: (typeof WORLDCUP_BETS)[number] }) {
  const tint = TINT_CLASS[bet.tint];
  const yesPct = bet.yesPct;
  const noPct = 100 - yesPct;
  return (
    <Link
      href={`/markets?search=${encodeURIComponent(bet.question)}`}
      className={cn(
        "group flex h-full flex-col rounded-2xl p-5 transition-all hover:-translate-y-1",
        tint.bg,
        tint.border,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={cn(
            "punt-sticker",
            tint.tagBorder,
            tint.tagBg,
            tint.tagText,
          )}
        >
          {bet.tag}
        </span>
        {bet.tone === "silly" && (
          <span className="rounded-pill bg-punt-paper/60 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-punt-ink/65">
            Silly
          </span>
        )}
      </div>

      <p
        className={cn(
          "mt-4 line-clamp-3 text-base font-bold leading-snug",
          tint.text,
        )}
      >
        {bet.question}
      </p>

      <div className="mt-4 grid grid-cols-2 gap-1.5">
        <span className="rounded-xl bg-punt-paper/70 px-2.5 py-1.5 text-center">
          <div className="text-[10px] font-bold uppercase tracking-wider text-punt-ink/55">
            Yes
          </div>
          <div className="text-sm font-extrabold tabular-nums text-emerald-700">
            {yesPct}¢
          </div>
        </span>
        <span className="rounded-xl bg-punt-paper/70 px-2.5 py-1.5 text-center">
          <div className="text-[10px] font-bold uppercase tracking-wider text-punt-ink/55">
            No
          </div>
          <div className="text-sm font-extrabold tabular-nums text-rose-700">
            {noPct}¢
          </div>
        </span>
      </div>

      <div className="mt-auto flex items-center justify-between pt-4 text-[11px] font-bold">
        <span className={tint.subtle}>Make the call</span>
        <IconArrowRight
          size={14}
          variant="Linear"
          color="currentColor"
          className={cn(
            "transition-transform group-hover:translate-x-0.5",
            tint.text,
          )}
        />
      </div>
    </Link>
  );
}

// ─── Tint palette per card ───────────────────────────────────────────────

const TINT_CLASS: Record<
  (typeof WORLDCUP_BETS)[number]["tint"],
  {
    bg: string;
    border: string;
    text: string;
    subtle: string;
    tagBg: string;
    tagText: string;
    tagBorder: string;
  }
> = {
  lime: {
    bg: "bg-punt-lime-soft",
    border: "border border-transparent",
    text: "text-punt-ink",
    subtle: "text-punt-ink/65",
    tagBg: "bg-punt-paper",
    tagText: "text-punt-ink",
    tagBorder: "border-punt-ink/80",
  },
  amber: {
    bg: "bg-amber-100",
    border: "border border-transparent",
    text: "text-punt-ink",
    subtle: "text-amber-800",
    tagBg: "bg-punt-paper",
    tagText: "text-punt-ink",
    tagBorder: "border-punt-ink/80",
  },
  sky: {
    bg: "bg-sky-100",
    border: "border border-transparent",
    text: "text-punt-ink",
    subtle: "text-sky-800",
    tagBg: "bg-punt-paper",
    tagText: "text-punt-ink",
    tagBorder: "border-punt-ink/80",
  },
  rose: {
    bg: "bg-rose-100",
    border: "border border-transparent",
    text: "text-punt-ink",
    subtle: "text-rose-800",
    tagBg: "bg-punt-paper",
    tagText: "text-punt-ink",
    tagBorder: "border-punt-ink/80",
  },
  lavender: {
    bg: "bg-violet-100",
    border: "border border-transparent",
    text: "text-punt-ink",
    subtle: "text-violet-800",
    tagBg: "bg-punt-paper",
    tagText: "text-punt-ink",
    tagBorder: "border-punt-ink/80",
  },
  ink: {
    bg: "bg-punt-ink",
    border: "border border-transparent",
    text: "text-punt-paper",
    subtle: "text-punt-paper/65",
    tagBg: "bg-punt-paper/10",
    tagText: "text-punt-paper",
    tagBorder: "border-punt-paper/30",
  },
};
