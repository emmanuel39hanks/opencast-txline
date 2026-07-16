"use client";

import Link from "next/link";
import { IconArrowRight } from "@/lib/icons";

/**
 * Slim "World Cup 2026" promo bar above the LandingHeader. No "New"
 * badge — just the headline with a clear "Predict the chaos →" tail so
 * users see this links somewhere.
 */
export function WorldCupPromoStrip() {
  return (
    <Link
      href="/worldcup"
      className="group block bg-punt-ink py-2.5 text-punt-paper transition-colors hover:bg-black"
    >
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-center gap-3 px-4 text-xs font-bold sm:px-8 sm:text-sm">
        <span>
          <span className="font-extrabold">World Cup 2026</span> markets
          are live. Will Messi cry? Will VAR overturn the final?
        </span>
        <span className="inline-flex items-center gap-1 text-punt-lime transition-transform group-hover:translate-x-0.5">
          Predict the chaos
          <IconArrowRight size={12} variant="Linear" color="#C9F468" />
        </span>
      </div>
    </Link>
  );
}
