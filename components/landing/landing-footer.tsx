"use client";

import { OpenCastWordmark } from "@/lib/brand-logos";

/**
 * Footer in the Punt brand language — a short blurb, the oversized OPENCAST
 * wordmark, and a minimal copyright line.
 */
export function LandingFooter() {
  return (
    <footer className="pt-20">
      <div className="border-t border-punt-ink/10 pt-12">
        <p className="text-2xl font-black tracking-tight text-punt-ink">
          Predict the World Cup.
        </p>
        <p className="mt-3 max-w-md text-sm font-medium text-punt-ink/60">
          Verifiable prediction markets — settled trustlessly on Solana against
          TxLINE proofs.
        </p>
      </div>

      {/* Oversized wordmark — SVG so it always fits edge-to-edge. */}
      <div className="mt-16 select-none">
        <OpenCastWordmark className="block h-auto w-full text-punt-ink" />
      </div>

      <div className="border-t border-punt-ink/10 py-6 text-xs font-medium text-punt-ink/55">
        <p>OPENCAST © {new Date().getFullYear()}</p>
      </div>
    </footer>
  );
}
