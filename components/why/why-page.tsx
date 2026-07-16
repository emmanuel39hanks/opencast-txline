"use client";

import Link from "next/link";
import {
  IconArrowRight,
  IconStar,
  IconChevronDown,
} from "@/lib/icons";

export interface WhySection {
  /** Sticker label on the section (e.g. "01", "02"). */
  tag: string;
  title: string;
  body: React.ReactNode;
  /** Optional list bullets rendered after the body copy. */
  bullets?: string[];
}

interface Props {
  eyebrow: string;
  title: string;
  /** Big subtitle/lede under the title. */
  lede: string;
  /** Background tone for the hero panel. */
  tone?: "lime" | "ink" | "paper";
  /** Sections rendered after the hero. */
  sections: WhySection[];
  /** Optional decorator badge in the hero (icon + label pill). */
  hint?: { Icon: React.ElementType; label: string };
}

/**
 * Shared layout for the three /why explainer pages. Same Punt language as
 * the rest of the app — sticker, oversized headline, sections in their
 * own paper cards, back-to-markets CTA at the bottom.
 */
export function WhyPage({
  eyebrow,
  title,
  lede,
  tone = "lime",
  sections,
  hint,
}: Props) {
  const heroBg =
    tone === "ink"
      ? "bg-punt-ink text-punt-paper"
      : tone === "paper"
        ? "bg-punt-paper text-punt-ink border border-punt-ink/8"
        : "bg-punt-lime text-punt-ink";

  const heroSubClass = tone === "ink" ? "text-punt-paper/70" : "text-punt-ink/65";

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
      <BackToMarkets />

      <section
        className={`relative mt-5 overflow-hidden rounded-card p-8 sm:p-10 ${heroBg}`}
      >
        <div className="flex items-center gap-2">
          <span className="punt-sticker -rotate-2 border-punt-ink/80 bg-punt-paper text-punt-ink">
            <IconStar size={11} variant="Linear" color="#0A0A0A" />
            {eyebrow}
          </span>
          {hint && (
            <span className="inline-flex items-center gap-1.5 rounded-pill bg-punt-ink/5 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-punt-ink/65">
              <hint.Icon size={12} variant="Linear" color="#0A0A0A" />
              {hint.label}
            </span>
          )}
        </div>
        <h1 className="mt-5 text-3xl font-bold leading-[1.05] tracking-tight sm:text-5xl">
          {title}
        </h1>
        <p className={`mt-4 max-w-2xl text-base font-medium sm:text-lg ${heroSubClass}`}>
          {lede}
        </p>
      </section>

      <div className="mt-6 space-y-4">
        {sections.map((s, i) => (
          <SectionCard key={i} {...s} />
        ))}
      </div>

      <FinalCta />
    </div>
  );
}

// ─── Atoms ───────────────────────────────────────────────────────────────

function BackToMarkets() {
  return (
    <Link
      href="/markets"
      className="inline-flex items-center gap-1.5 rounded-pill bg-punt-paper px-3 py-1.5 text-xs font-bold text-punt-ink/65 transition-colors hover:text-punt-ink"
    >
      <IconChevronDown
        size={14}
        variant="Linear"
        color="#0A0A0A"
        className="rotate-90"
      />
      Back to markets
    </Link>
  );
}

function SectionCard({ tag, title, body, bullets }: WhySection) {
  return (
    <article className="rounded-card border border-punt-ink/8 bg-punt-paper p-6 sm:p-8">
      <div className="flex items-center gap-3">
        <span className="punt-sticker border-punt-ink/80 bg-punt-paper text-punt-ink">
          {tag}
        </span>
        <h2 className="text-base font-bold tracking-tight text-punt-ink sm:text-lg">
          {title}
        </h2>
      </div>
      <div className="mt-4 space-y-3 text-sm font-medium leading-relaxed text-punt-ink/75 sm:text-base">
        {body}
      </div>
      {bullets && bullets.length > 0 && (
        <ul className="mt-4 space-y-2">
          {bullets.map((b, i) => (
            <li
              key={i}
              className="flex items-start gap-2.5 rounded-xl bg-punt-cream/50 px-3 py-2 text-sm font-medium text-punt-ink/75"
            >
              <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-punt-lime" />
              {b}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

function FinalCta() {
  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-card bg-punt-ink p-6 text-punt-paper sm:p-8">
      <div>
        <p className="text-xl font-bold tracking-tight sm:text-2xl">
          Try it for yourself.
        </p>
        <p className="mt-1 max-w-md text-sm font-medium text-punt-paper/65">
          Make a prediction on a live market in under a minute. Free testnet USDC
          included.
        </p>
      </div>
      <Link
        href="/markets"
        className="inline-flex items-center gap-2 rounded-pill bg-punt-lime px-5 py-3 text-sm font-extrabold text-punt-ink transition-transform hover:-translate-y-0.5"
      >
        Browse markets
        <IconArrowRight size={14} variant="Linear" color="#0A0A0A" />
      </Link>
    </div>
  );
}
