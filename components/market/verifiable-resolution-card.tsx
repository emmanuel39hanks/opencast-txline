"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { IconShield, IconArrowRight } from "@/lib/icons";
import type { Market } from "@/lib/types";

const SETTLEMENT_PROGRAM = process.env.NEXT_PUBLIC_SETTLEMENT_PROGRAM_ID ?? "";
const TXORACLE = "6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J";

/**
 * Compact "how this settles" strip — no admin, no oracle multisig. On settle,
 * our program CPIs into TxLINE's on-chain `validate_stat_v2`, which verifies
 * a Merkle proof of the match stat. The deep receipt lives on /verify.
 */
export function VerifiableResolutionCard({ market }: { market: Market }) {
  const marketPda = (market as { marketPda?: string | null }).marketPda;
  const verifyHref = marketPda
    ? `/verify/${market.id}?m=${marketPda}`
    : `/verify/${market.id}`;

  const steps = [
    {
      n: "1",
      title: "TxLINE anchors the stats",
      body: "Every score update is hashed into a Merkle tree; the root lands on Solana.",
    },
    {
      n: "2",
      title: "The chain checks the proof",
      body: "Settlement CPIs into validate_stat_v2 — we never touch the outcome.",
    },
    {
      n: "3",
      title: "Winners paid pro-rata",
      body: "The pool pays out against the verified stat. 2% fee, nothing else.",
    },
  ];

  return (
    <div className="rounded-card border border-punt-ink/8 bg-punt-paper p-5">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-punt-lime">
            <IconShield size={15} variant="Bold" color="#0A0A0A" />
          </span>
          <div>
            <h2 className="text-base font-black leading-tight text-punt-ink">
              Settles itself
            </h2>
            <p className="text-[11px] font-medium text-punt-ink/50">
              No admin decides — a Merkle proof does.
            </p>
          </div>
        </div>
        <Link
          href={verifyHref}
          className="inline-flex items-center gap-1.5 rounded-pill bg-punt-ink px-4 py-2 text-xs font-extrabold text-punt-paper transition-transform hover:-translate-y-0.5"
        >
          Inspect the proof
          <IconArrowRight size={13} variant="Linear" color="#F5F1E8" />
        </Link>
      </div>

      {/* Steps — one compact row */}
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {steps.map((s) => (
          <div
            key={s.n}
            className="rounded-2xl bg-punt-cream/50 p-3.5"
          >
            <div className="flex items-center gap-2">
              <span className="grid h-5 w-5 place-items-center rounded-full bg-punt-ink font-mono text-[10px] font-black text-punt-lime">
                {s.n}
              </span>
              <span className="text-[12px] font-extrabold leading-tight text-punt-ink">
                {s.title}
              </span>
            </div>
            <p className="mt-1.5 text-[11px] font-medium leading-relaxed text-punt-ink/55">
              {s.body}
            </p>
          </div>
        ))}
      </div>

      {/* Reference chips */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <RefChip label="txoracle" value={TXORACLE} />
        <RefChip label="settlement" value={SETTLEMENT_PROGRAM} />
        <span className="text-[10px] font-medium text-punt-ink/35">
          Solana devnet · anyone can replay the proof
        </span>
      </div>
    </div>
  );
}

function RefChip({ label, value }: { label: string; value: string }) {
  const short = value ? `${value.slice(0, 4)}…${value.slice(-4)}` : "—";
  return (
    <a
      href={`https://explorer.solana.com/address/${value}?cluster=devnet`}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 rounded-pill border border-punt-ink/10 bg-punt-paper px-2.5 py-1 font-mono text-[11px] font-bold text-punt-ink/70 transition-colors hover:border-punt-ink/25 hover:text-punt-ink"
    >
      <span className="text-[9px] font-black uppercase tracking-wider text-punt-ink/40">
        {label}
      </span>
      {short}
      <ExternalLink className="h-2.5 w-2.5 text-punt-ink/35" />
    </a>
  );
}
