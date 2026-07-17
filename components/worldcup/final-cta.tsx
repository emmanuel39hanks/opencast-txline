"use client";

import Link from "next/link";

/**
 * Closing CTA for /worldcup. Lime card with the oversized headline +
 * "Start predicting" button. Sits before the standard landing footer.
 */
export function WorldCupFinalCta() {
  return (
    <section className="relative overflow-hidden rounded-card bg-punt-lime px-6 py-20 text-center sm:py-28">
      <Sparkle className="pointer-events-none absolute left-[10%] top-[24%] h-6 w-6 text-punt-ink/30" />
      <Sparkle className="pointer-events-none absolute right-[14%] top-[18%] h-5 w-5 text-punt-ink/25" />
      <Sparkle className="pointer-events-none absolute left-[18%] bottom-[20%] h-5 w-5 text-punt-ink/25" />
      <Sparkle className="pointer-events-none absolute right-[20%] bottom-[24%] h-6 w-6 text-punt-ink/30" />

      <div className="relative mx-auto max-w-3xl">
        <span className="punt-sticker -rotate-3 border-punt-ink/80 bg-punt-paper text-punt-ink">
          The final settles on-chain
        </span>
        <h2 className="mt-6 text-5xl font-bold leading-[0.95] tracking-tight text-punt-ink sm:text-7xl">
          Pick your moment.
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-base font-medium text-punt-ink/70 sm:text-lg">
          From "Argentina lifts the cup" to "a streaker invades the
          pitch" — every market settles on-chain and ships with a receipt.
        </p>

        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link
            href="/markets"
            className="rounded-pill bg-punt-ink px-7 py-3.5 text-base font-extrabold text-punt-paper transition-transform hover:-translate-y-0.5"
          >
            Browse World Cup markets
          </Link>
          <Link
            href="/create"
            className="rounded-pill border border-punt-ink/15 bg-punt-paper px-7 py-3.5 text-base font-extrabold text-punt-ink transition-transform hover:-translate-y-0.5"
          >
            Create your own market
          </Link>
        </div>
      </div>
    </section>
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
