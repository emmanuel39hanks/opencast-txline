"use client";

import { SectionHeading } from "./how-it-works";
import { Reveal } from "./reveal";

/**
 * Why it's different — magazine rows, not tiles. Tag | claim | explanation,
 * separated by hairlines.
 */
export function BuiltDifferent() {
  const rows = [
    {
      tag: "Trustless",
      title: "The score decides. Nobody else.",
      body: "Settlement is a cross-program call into TxLINE's on-chain oracle with a Merkle proof of the match stats. If the proof doesn't check out, the market simply can't pay — there is no override.",
    },
    {
      tag: "Verifiable",
      title: "Every result has a receipt.",
      body: "Open any market's proof page: the score, the stat that settled it, and every hash connecting it to the on-chain root. Check it yourself — no OpenCast server required.",
    },
    {
      tag: "Automatic",
      title: "Settles while you sleep.",
      body: "A keeper watches every fixture. The moment a match is final and provable, it settles the markets — winners just claim.",
    },
    {
      tag: "Open economics",
      title: "One fee. That's it.",
      body: "The platform takes 2% of winning payouts, withheld at claim time by the program itself. No spread, no juice, no house edge hiding in the odds.",
    },
  ];

  return (
    <div>
      <SectionHeading
        eyebrow="Why it's different"
        title="A prediction market with nobody behind the counter."
      />
      <div>
        {rows.map((r, i) => (
          <Reveal key={r.tag} delay={i * 0.06}>
            <div className="grid gap-2 border-t border-punt-ink/10 py-8 md:grid-cols-[200px_1.2fr_1.6fr] md:gap-8 md:py-10">
              <span className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-punt-ink/40">
                {r.tag}
              </span>
              <h3 className="text-2xl font-black leading-tight tracking-tight text-punt-ink sm:text-3xl">
                {r.title}
              </h3>
              <p className="max-w-xl text-sm font-medium leading-relaxed text-punt-ink/60 sm:text-base">
                {r.body}
              </p>
            </div>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
