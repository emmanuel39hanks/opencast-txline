"use client";

import Link from "next/link";
import { OpenCastWordmark } from "@/lib/brand-logos";

/**
 * Footer in the Punt brand language — a short blurb, links, the oversized
 * OPENCAST wordmark, and a minimal copyright line.
 */
export function LandingFooter() {
  return (
    <footer className="pt-20">
      <div className="flex flex-wrap items-end justify-between gap-6 border-t border-punt-ink/10 pt-12">
        <div>
          <p className="text-2xl font-black tracking-tight text-punt-ink">
            Predict the World Cup.
          </p>
          <p className="mt-3 max-w-md text-sm font-medium text-punt-ink/60">
            Verifiable prediction markets — settled trustlessly on Solana
            against TxLINE proofs.
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-bold text-punt-ink/60">
          <Link href="/markets" className="transition-colors hover:text-punt-ink">
            Markets
          </Link>
          <Link href="/docs" className="transition-colors hover:text-punt-ink">
            Docs
          </Link>
          <a
            href="https://github.com/emmanuel39hanks/opencast-txline"
            target="_blank"
            rel="noreferrer"
            className="transition-colors hover:text-punt-ink"
          >
            GitHub
          </a>
        </nav>
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
