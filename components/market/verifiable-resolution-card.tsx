"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { IconShield, IconArrowRight } from "@/lib/icons";
import { useReceipt, receiptEquation } from "@/lib/hooks/useReceipt";
import { TeamCircle } from "@/components/market/market-card";
import { cn } from "@/lib/utils";
import type { Market } from "@/lib/types";

const SETTLEMENT_PROGRAM = process.env.NEXT_PUBLIC_SETTLEMENT_PROGRAM_ID ?? "";
const TXORACLE = "6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J";

/**
 * Resolution strip on the market page.
 *
 * Before settlement: a compact "how this settles" explainer — no admin, no
 * oracle multisig, a Merkle proof does it.
 *
 * After settlement: the actual receipt — final score, the settlement math,
 * the independent-recomputation badge, and the on-chain trail. The deep dive
 * lives on /verify.
 */
export function VerifiableResolutionCard({ market }: { market: Market }) {
  const marketPda = (market as { marketPda?: string | null }).marketPda;
  const verifyHref = marketPda
    ? `/verify/${market.id}?m=${marketPda}`
    : `/verify/${market.id}`;
  const resolved = market.status === "RESOLVED";
  const { data: r } = useReceipt(market, { enabled: resolved });

  if (resolved) {
    return (
      <ReceiptCard market={market} receipt={r} verifyHref={verifyHref} />
    );
  }

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
    <div className="rounded-card border border-punt-ink/8 bg-punt-paper p-4 sm:p-5">
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
          <div key={s.n} className="rounded-2xl bg-punt-cream/50 p-3.5">
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

/** The post-settlement mini-receipt. */
function ReceiptCard({
  market,
  receipt,
  verifyHref,
}: {
  market: Market;
  receipt: ReturnType<typeof useReceipt>["data"];
  verifyHref: string;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const m = market as any;
  const yes = m.finalOutcome === "Yes";
  const winnersLabel = yes ? (m.yesLabel ?? "Yes") : (m.noLabel ?? "No");
  const home = receipt?.home ?? m.home;
  const away = receipt?.away ?? m.away;
  const equation = receipt ? receiptEquation(receipt) : null;

  return (
    <div className="overflow-hidden rounded-card border border-punt-ink/8 bg-punt-paper">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-punt-ink/[0.06] bg-punt-ink px-4 py-3 sm:px-5">
        <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.15em] text-punt-paper">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-punt-lime">
            <IconShield size={12} variant="Bold" color="#0A0A0A" />
          </span>
          Settlement receipt
        </span>
        {receipt?.independentCheck === "recomputed-ok" && (
          <span className="rounded-pill bg-punt-lime px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-punt-ink">
            Recomputed independently ✓
          </span>
        )}
      </div>

      <div className="p-4 sm:p-5">
        {/* Score row */}
        {receipt?.score && home && away && (
          <div className="flex items-center justify-center gap-3 sm:gap-4">
            <span className="flex min-w-0 items-center gap-2">
              <TeamCircle name={home} size={30} />
              <span className="hidden truncate text-sm font-bold text-punt-ink sm:block">
                {home}
              </span>
            </span>
            <span className="font-mono text-3xl font-black tabular-nums text-punt-ink">
              {receipt.score.home}
              <span className="mx-1 text-punt-ink/20">–</span>
              {receipt.score.away}
            </span>
            <span className="flex min-w-0 items-center gap-2">
              <span className="hidden truncate text-sm font-bold text-punt-ink sm:block">
                {away}
              </span>
              <TeamCircle name={away} size={30} />
            </span>
          </div>
        )}
        {receipt?.score?.final && (
          <div className="mt-1 text-center text-[10px] font-bold uppercase tracking-wider text-punt-ink/40">
            Full-time
          </div>
        )}

        {/* Verdict */}
        <div className="mt-4 rounded-2xl bg-punt-cream/60 p-3.5">
          <div className="text-xs font-bold leading-snug text-punt-ink/70">
            {market.question}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "rounded-pill px-2.5 py-0.5 text-xs font-black uppercase tracking-wide",
                yes ? "bg-punt-lime text-punt-ink" : "bg-rose-500 text-white",
              )}
            >
              {yes ? "Yes" : "No"}
            </span>
            <span className="text-xs font-bold text-punt-ink/60">
              &ldquo;{winnersLabel}&rdquo; backers were paid from the pool.
            </span>
          </div>
          {equation && (
            <div className="mt-2.5 overflow-x-auto rounded-xl bg-punt-ink px-3 py-2 font-mono text-[11px] font-bold text-punt-lime">
              {equation} → {yes ? "YES" : "NO"}
            </div>
          )}
        </div>

        {/* Trail */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {receipt?.settleTxSig && (
            <RefChip
              label="settle tx"
              value={receipt.settleTxSig}
              href={`https://explorer.solana.com/tx/${receipt.settleTxSig}?cluster=devnet`}
            />
          )}
          {receipt?.dailyRootPda && (
            <RefChip
              label="anchored root"
              value={receipt.dailyRootPda}
              href={`https://explorer.solana.com/address/${receipt.dailyRootPda}?cluster=devnet`}
            />
          )}
          <Link
            href={verifyHref}
            className="ml-auto inline-flex items-center gap-1.5 rounded-pill bg-punt-ink px-4 py-2 text-xs font-extrabold text-punt-paper transition-transform hover:-translate-y-0.5"
          >
            Full receipt
            <IconArrowRight size={13} variant="Linear" color="#F5F1E8" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function RefChip({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href?: string;
}) {
  const short = value ? `${value.slice(0, 4)}…${value.slice(-4)}` : "—";
  return (
    <a
      href={href ?? `https://explorer.solana.com/address/${value}?cluster=devnet`}
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
