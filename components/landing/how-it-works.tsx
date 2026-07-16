"use client";

import { Reveal } from "./reveal";

/**
 * How it works — editorial, no cards. Three columns split by hairlines,
 * each led by an oversized ghost numeral.
 */
export function HowItWorks() {
  const steps = [
    {
      n: "01",
      title: "Type your prediction",
      body: "“England to score 2+.” The AI turns it into a market with an on-chain rule. If the stat can't be proven from match data, the market can't exist — that's the filter.",
    },
    {
      n: "02",
      title: "Back YES or NO",
      body: "Stake USDC at pool odds — the price is simply what the crowd has staked on each side. Or stack picks from different matches into one parlay ticket.",
    },
    {
      n: "03",
      title: "The proof settles it",
      body: "Full-time. TxLINE's score proof hits the chain, the market settles itself, and winners claim their share of the pool. Nobody presses a button.",
    },
  ];

  return (
    <div>
      <SectionHeading eyebrow="How it works" title="Predict in plain English." />
      <div className="grid gap-10 border-t border-punt-ink/10 pt-10 md:grid-cols-3 md:gap-0 md:divide-x md:divide-punt-ink/10">
        {steps.map((s, i) => (
          <Reveal key={s.n} delay={i * 0.12} className="md:px-10 md:first:pl-0 md:last:pr-0">
            <div className="font-mono text-6xl font-black leading-none text-punt-ink/[0.12] sm:text-7xl">
              {s.n}
            </div>
            <h3 className="mt-4 text-2xl font-black tracking-tight text-punt-ink">
              {s.title}
            </h3>
            <p className="mt-3 text-sm font-medium leading-relaxed text-punt-ink/60">
              {s.body}
            </p>
          </Reveal>
        ))}
      </div>
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = "left",
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  align?: "left" | "center";
}) {
  const alignClass = align === "center" ? "text-center mx-auto" : "text-left";
  return (
    <Reveal className={`mb-8 max-w-2xl ${alignClass}`}>
      <span className="text-xs font-bold uppercase tracking-[0.25em] text-punt-ink/50">
        {eyebrow}
      </span>
      <h2 className="mt-3 text-4xl font-black tracking-tight text-punt-ink sm:text-5xl">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-3 text-base font-medium text-punt-ink/60">{subtitle}</p>
      )}
    </Reveal>
  );
}
