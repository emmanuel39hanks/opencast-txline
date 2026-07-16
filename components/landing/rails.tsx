"use client";

import { ExternalLink } from "lucide-react";
import { Reveal } from "./reveal";

const SETTLEMENT = process.env.NEXT_PUBLIC_SETTLEMENT_PROGRAM_ID ?? "";
const TXORACLE = "6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J";

/**
 * The rails — one dark band, two columns divided by a hairline. Solana holds
 * the money, TxLINE holds the truth; the chain checks that they agree.
 */
export function Rails() {
  return (
    <Reveal>
    <div className="overflow-hidden rounded-card bg-punt-ink px-7 py-10 text-punt-paper sm:px-12 sm:py-14">
      <div className="max-w-2xl">
        <span className="text-xs font-bold uppercase tracking-[0.25em] text-punt-paper/45">
          The rails
        </span>
        <h2 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
          Two systems. Zero trust required.
        </h2>
        <p className="mt-3 text-base font-medium text-punt-paper/60">
          Your money lives on one, the truth lives on the other — and the chain
          checks that they agree.
        </p>
      </div>

      <div className="mt-10 grid gap-10 md:grid-cols-2 md:gap-0 md:divide-x md:divide-punt-paper/10">
        {/* Solana */}
        <div className="md:pr-10">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/landing/solana-logo.png" alt="Solana" className="h-7 w-7" />
            <span className="text-2xl font-black tracking-tight">Solana</span>
            <span className="rounded-pill bg-punt-paper/10 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-punt-paper/60">
              Markets · predictions · payouts
            </span>
          </div>
          <p className="mt-4 max-w-md text-sm font-medium leading-relaxed text-punt-paper/65">
            Every market is a program account. Every prediction is a token transfer
            into its pool. Settlement and claims are on-chain instructions
            anyone can read — there is no OpenCast database deciding who gets
            paid.
          </p>
          <AddressChip label="Settlement program" addr={SETTLEMENT} />
        </div>

        {/* TxODDS / TxLINE */}
        <div className="md:pl-10">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/landing/txline-logo-white.svg" alt="TxLINE" className="h-7" />
            <span className="rounded-pill bg-punt-paper/10 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-punt-paper/60">
              Provable match data · by TxODDS
            </span>
          </div>
          <p className="mt-4 max-w-md text-sm font-medium leading-relaxed text-punt-paper/65">
            TxODDS feeds live sports data to the betting industry. TxLINE makes
            it provable: every score update is sequenced, hashed into a Merkle
            tree, and anchored on Solana — so a match result can be verified,
            not just believed.
          </p>
          <AddressChip label="txoracle · validate_stat_v2" addr={TXORACLE} />
        </div>
      </div>
    </div>
    </Reveal>
  );
}

function AddressChip({ label, addr }: { label: string; addr: string }) {
  return (
    <a
      href={`https://explorer.solana.com/address/${addr}?cluster=devnet`}
      target="_blank"
      rel="noreferrer"
      className="mt-5 inline-flex items-center gap-2 rounded-pill border border-punt-paper/15 px-3 py-1.5 font-mono text-[11px] font-bold text-punt-paper/70 transition-colors hover:border-punt-paper/40 hover:text-punt-paper"
    >
      <span className="text-[9px] font-black uppercase tracking-wider text-punt-paper/40">
        {label}
      </span>
      {addr ? `${addr.slice(0, 4)}…${addr.slice(-4)}` : "—"}
      <ExternalLink className="h-2.5 w-2.5 opacity-50" />
    </a>
  );
}
