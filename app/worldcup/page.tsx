"use client";

import { WorldCupHero } from "@/components/worldcup/hero";
import { CountdownBand } from "@/components/worldcup/countdown-band";
import { SillyBetsGrid } from "@/components/worldcup/silly-bets-grid";
import { MatchSchedule } from "@/components/worldcup/match-schedule";
import { ChainMap } from "@/components/worldcup/chain-map";
import { RollingText } from "@/components/worldcup/rolling-text";
import { WorldCupFinalCta } from "@/components/worldcup/final-cta";

/**
 * /worldcup — themed landing for the 2026 World Cup vertical campaign.
 *
 * Composition (top → bottom):
 *   1. Hero — split layout, featured market preview
 *   2. Countdown band — kickoff timer
 *   3. Silly bets grid — curated templates
 *   4. Rolling text band — "World Cup 2026 · Bet the chaos · On-chain"
 *   5. Match schedule — row layout
 *   6. Settlement stack — TxLINE + Solana + USDC
 *   7. Lime final CTA
 *
 * Every illustration on this page is rendered from inline SVG / CSS or
 * sourced from the brand assets in public/brand/.
 */
export default function WorldCupPage() {
  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-8 px-4 py-6 sm:space-y-12 sm:px-6 sm:py-8">
      <WorldCupHero />
      <CountdownBand />
      <SillyBetsGrid />
      <RollingText />
      <MatchSchedule />
      <ChainMap />
      <WorldCupFinalCta />
    </div>
  );
}
