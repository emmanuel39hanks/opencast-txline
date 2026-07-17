"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { IconArrowRight, IconTrendUp, IconShield } from "@/lib/icons";

/**
 * /worldcup hero — Punt language, light surface, brand-consistent.
 *
 * Two-column layout: left carries the headline + subhead + CTAs, right
 * carries a stylised featured market card so visitors see the actual
 * product surface in the hero. Soft cream background, subtle soccer
 * motifs in the negative space, lime + ink accents.
 */
export function WorldCupHero() {
  return (
    <section className="relative overflow-hidden rounded-card border border-punt-ink/8 bg-punt-paper px-6 py-12 sm:px-10 sm:py-16">
      <BackgroundField />

      <div className="relative grid items-center gap-10 lg:grid-cols-[1.2fr,1fr]">
        {/* Left — copy column */}
        <div>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex flex-wrap items-center gap-2"
          >
            <span className="punt-sticker -rotate-3 border-punt-ink/80 bg-punt-paper text-punt-ink">
              World Cup 2026
            </span>
            <span className="punt-sticker border-punt-ink/80 bg-punt-lime text-punt-ink">
              Settled on-chain
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05 }}
            className="mt-6 font-black text-punt-ink"
            style={{
              fontSize: "clamp(48px, 7vw, 88px)",
              lineHeight: 0.95,
              letterSpacing: "-0.03em",
            }}
          >
            Predict the goals.
            <br />
            <span className="relative inline-block">
              Predict the chaos.
              <svg
                className="absolute -bottom-2 left-0 h-3 w-full sm:-bottom-3 sm:h-4"
                viewBox="0 0 400 16"
                fill="none"
                aria-hidden
              >
                <path
                  d="M3 11 C 80 4, 220 14, 397 6"
                  stroke="#C9F468"
                  strokeWidth="6"
                  strokeLinecap="round"
                  fill="none"
                />
              </svg>
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            className="mt-7 max-w-xl text-base font-medium text-punt-ink/65 sm:text-lg"
          >
            48 teams. 104 matches. 1 verifiable trophy. Every result settles
            trustlessly on Solana against TxLINE&apos;s on-chain proof.
          </motion.p>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="mt-8 flex flex-wrap gap-3"
          >
            <Link
              href="/markets"
              className="inline-flex items-center gap-2 rounded-pill bg-punt-ink px-6 py-3.5 text-sm font-extrabold text-punt-paper transition-transform hover:-translate-y-0.5 sm:text-base"
            >
              Browse markets
              <IconArrowRight size={16} variant="Linear" color="#F2F2EE" />
            </Link>
            <Link
              href="#silly-predictions"
              className="inline-flex items-center gap-2 rounded-pill border border-punt-ink/15 bg-punt-paper px-6 py-3.5 text-sm font-extrabold text-punt-ink transition-transform hover:-translate-y-0.5 sm:text-base"
            >
              See the silly predictions
            </Link>
          </motion.div>

          {/* Inline meta strip — partners + product proof points */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-bold text-punt-ink/55"
          >
            <span className="inline-flex items-center gap-1.5">
              <IconShield size={13} variant="Linear" color="#0A0A0A" />
              TxLINE proof on every settlement
            </span>
            <span className="inline-flex items-center gap-1.5">
              <IconTrendUp size={13} variant="Linear" color="#0A0A0A" />
              Live TxLINE match data
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              Settles in USDC
            </span>
          </motion.div>
        </div>

        {/* Right — featured market card */}
        <FeaturedCard />
      </div>
    </section>
  );
}

// ─── Featured "Will Argentina lift the trophy?" preview ─────────────────

function FeaturedCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="relative"
    >
      {/* Tilted ghost card behind for depth */}
      <div className="pointer-events-none absolute inset-0 -rotate-2 rounded-3xl border border-punt-ink/8 bg-punt-cream" />
      <div className="relative rounded-3xl border border-punt-ink/10 bg-punt-paper p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="punt-sticker border-punt-ink/80 bg-punt-paper text-punt-ink">
            Featured · The trophy
          </span>
          <span className="inline-flex items-center gap-1 rounded-pill bg-emerald-100 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            Live
          </span>
        </div>

        <p className="mt-4 text-xl font-bold leading-snug text-punt-ink sm:text-2xl">
          Will Argentina win back-to-back World Cups?
        </p>

        <div className="mt-5 grid grid-cols-2 gap-2.5">
          <div className="rounded-2xl bg-punt-lime-soft px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-punt-ink/60">
              Yes
            </div>
            <div className="mt-0.5 flex items-baseline justify-between">
              <span className="text-3xl font-black tabular-nums text-punt-ink">
                18¢
              </span>
              <span className="text-xs font-bold text-emerald-700">+0.4%</span>
            </div>
          </div>
          <div className="rounded-2xl bg-rose-50 px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-punt-ink/60">
              No
            </div>
            <div className="mt-0.5 flex items-baseline justify-between">
              <span className="text-3xl font-black tabular-nums text-punt-ink">
                82¢
              </span>
              <span className="text-xs font-bold text-rose-700">−0.4%</span>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2 text-xs font-bold">
          <span className="rounded-pill bg-punt-ink/5 px-2.5 py-1 text-punt-ink/65">
            $4.2M traded
          </span>
          <span className="rounded-pill bg-punt-ink/5 px-2.5 py-1 text-punt-ink/65">
            Closes Jul 19
          </span>
          <span className="rounded-pill bg-punt-lime px-2.5 py-1 text-punt-ink">
            Receipt ready
          </span>
        </div>

        <Link
          href="/markets"
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-pill bg-punt-ink py-3 text-sm font-extrabold text-punt-paper transition-transform hover:-translate-y-0.5"
        >
          Trade this market
          <IconArrowRight size={14} variant="Linear" color="#F2F2EE" />
        </Link>
      </div>

      {/* Soccer ball peeking from behind the card */}
      <SoccerBall className="pointer-events-none absolute -right-6 -top-6 h-16 w-16 rotate-12 sm:-right-8 sm:-top-8 sm:h-20 sm:w-20" />
    </motion.div>
  );
}

// ─── Decorative background ──────────────────────────────────────────────

function BackgroundField() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #0A0A0A 1px, transparent 1px), linear-gradient(to bottom, #0A0A0A 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />
      <SoccerBall className="pointer-events-none absolute -left-6 -bottom-8 h-24 w-24 animate-float opacity-90 sm:h-32 sm:w-32" />
      <Sparkle className="pointer-events-none absolute right-[28%] top-[12%] h-4 w-4 text-punt-ink/35" />
      <Sparkle className="pointer-events-none absolute left-[32%] bottom-[16%] h-5 w-5 text-punt-ink/40" />
    </>
  );
}

function SoccerBall({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden>
      <circle cx="32" cy="32" r="29" fill="#FFFFFF" stroke="#0A0A0A" strokeWidth="2" />
      <polygon points="32,18 45,28 40,44 24,44 19,28" fill="#0A0A0A" />
      <path d="M32 4 L32 18" stroke="#0A0A0A" strokeWidth="2" />
      <path d="M58 22 L45 28" stroke="#0A0A0A" strokeWidth="2" />
      <path d="M52 50 L40 44" stroke="#0A0A0A" strokeWidth="2" />
      <path d="M12 50 L24 44" stroke="#0A0A0A" strokeWidth="2" />
      <path d="M6 22 L19 28" stroke="#0A0A0A" strokeWidth="2" />
    </svg>
  );
}

function Sparkle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M12 2 L13.5 10.5 L22 12 L13.5 13.5 L12 22 L10.5 13.5 L2 12 L10.5 10.5 Z"
        fill="currentColor"
      />
    </svg>
  );
}
