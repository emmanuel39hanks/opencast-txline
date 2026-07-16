"use client";

/**
 * Edge-to-edge rolling text band — Antigravity-style oversized wordmark.
 * Sits between the silly bets and the schedule as a visual reset.
 */
export function RollingText() {
  const phrases = Array.from({ length: 6 });
  return (
    <section className="overflow-hidden bg-punt-ink py-6 sm:py-8">
      <div className="flex animate-marquee gap-12 whitespace-nowrap">
        {phrases.map((_, i) => (
          <span
            key={i}
            className="flex shrink-0 items-center gap-12 font-black uppercase tracking-tight text-punt-paper"
            style={{
              fontSize: "clamp(48px, 7vw, 96px)",
              letterSpacing: "-0.03em",
              lineHeight: 1,
            }}
          >
            World Cup 2026
            <Star />
            Predict the chaos
            <Star />
            On-chain. With receipts.
            <Star />
          </span>
        ))}
      </div>
    </section>
  );
}

function Star() {
  return (
    <span className="text-punt-lime" aria-hidden>
      ★
    </span>
  );
}
