"use client";

import { WhyPage } from "@/components/why/why-page";
import { IconLink } from "@/lib/icons";

export default function WhySettlementPage() {
  return (
    <WhyPage
      eyebrow="Why OpenCast"
      title="Settlement you don't have to trust."
      lede="When a match ends, OpenCast's Solana program verifies TxLINE's on-chain proof and releases the escrow pro-rata — automatically. No admin signs the outcome. No dispute window. The score decides, and the chain checks it."
      tone="paper"
      hint={{ Icon: IconLink, label: "Trustless" }}
      sections={[
        {
          tag: "01",
          title: "Escrow on Solana",
          body: (
            <p>
              Creating a market spins up an on-chain escrow: a vault plus a
              YES/NO pool. Predictions transfer USDC into the vault and update
              the pools. Everything — stake, pools, settlement — lives in the
              settlement program on Solana devnet. There is no backend ledger to
              trust.
            </p>
          ),
          bullets: [
            "Native SPL USDC as the settlement currency.",
            "Parimutuel YES/NO pools; pricing is the pool ratio.",
            "Position accounts track each wallet's stake on-chain.",
          ],
        },
        {
          tag: "02",
          title: "Settlement is a cross-program call",
          body: (
            <p>
              When the match is final, a keeper calls the program with
              TxLINE&apos;s Merkle proof. The program CPIs into TxLINE&apos;s{" "}
              <code className="rounded bg-punt-ink/5 px-1.5 py-0.5 font-mono text-xs font-bold">
                validate_stat_v2
              </code>
              , which checks the stat against the daily root TxLINE committed
              on-chain. Only if the proof is valid does the market resolve — and
              it resolves to exactly what the proof says.
            </p>
          ),
        },
        {
          tag: "03",
          title: "Winners claim, pro-rata",
          body: (
            <p>
              Once settled, winners claim their share of the vault against the
              verified outcome, minus a flat 2% platform fee. The payout is
              math over on-chain state — anyone can compute it, and the program
              enforces it.
            </p>
          ),
        },
        {
          tag: "04",
          title: "One wallet, no seams",
          body: (
            <p>
              Privy hands you a single embedded Solana wallet — sign in with
              email, no extension, no seed phrase. It signs every action:
              create, predict, claim. The app funds a little devnet SOL for gas
              so you never hit a dead end. Pick a market, place your prediction,
              re-verify the proof. That&apos;s the whole loop.
            </p>
          ),
        },
      ]}
    />
  );
}
