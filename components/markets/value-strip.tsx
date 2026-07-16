"use client";

import Link from "next/link";
import {
  IconShield,
  IconActivity,
  IconLink,
  IconArrowRight,
} from "@/lib/icons";

/**
 * Vertical 3-card strip used in the /markets featured-hero right column.
 *
 * Each card is a paper-white outlined tile — matches the bet card
 * language elsewhere on the site. Click → dedicated explainer page
 * under /why.
 */
export function ValueStrip() {
  return (
    <div className="flex flex-col gap-3">
      <ValueCard
        href="/why/verifiable"
        Icon={IconShield}
        title="Verifiable Resolutions"
        body="Every result carries a TxLINE Merkle proof — re-verify it on-chain."
      />
      <ValueCard
        href="/why/agents"
        Icon={IconActivity}
        title="Real-Time World Cup Data"
        body="Live scores and events, straight from the TxLINE feed."
      />
      <ValueCard
        href="/why/cross-chain"
        Icon={IconLink}
        title="Trustless Settlement"
        body="Funds release on Solana the moment the proof checks out."
      />
    </div>
  );
}

function ValueCard({
  href,
  Icon,
  title,
  body,
}: {
  href: string;
  Icon: React.ElementType;
  title: string;
  body: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-2xl border border-punt-ink/8 bg-punt-paper p-4 transition-all hover:-translate-y-0.5 hover:border-punt-ink/15"
    >
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-punt-ink/5">
        <Icon size={20} variant="Linear" color="#0A0A0A" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-punt-ink">{title}</p>
        <p className="mt-0.5 line-clamp-2 text-xs font-medium text-punt-ink/60">
          {body}
        </p>
      </div>
      <IconArrowRight
        size={16}
        variant="Linear"
        color="#0A0A0A"
        className="shrink-0 opacity-40 transition-opacity group-hover:opacity-100"
      />
    </Link>
  );
}
