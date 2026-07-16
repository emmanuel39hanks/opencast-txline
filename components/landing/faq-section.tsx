"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { IconChevronDown } from "@/lib/icons";

const ITEMS = [
  {
    q: "Do I need crypto experience?",
    a: "No. Sign in with your email and a wallet is created for you in the background. Balances show in plain dollars, and test USDC is free to mint from the faucet.",
  },
  {
    q: "Where do the odds come from?",
    a: "From the pool. Every market has a YES side and a NO side; the price is simply what share of the money sits on each. Win, and you take your slice of the whole pool.",
  },
  {
    q: "How does a market settle?",
    a: "When a match ends, TxLINE publishes a cryptographic proof of the score. Our Solana program checks that proof on-chain and pays the winning side — automatically. No admin, no waiting on a moderator.",
  },
  {
    q: "How do I know a result is right?",
    a: "Every market has a proof page: the final score, the exact stat that settled it, and every hash connecting it to the on-chain root. If the proof doesn't verify, the market can't pay out.",
  },
  {
    q: "What can I predict?",
    a: "Anything TxLINE can prove from match data: winners, draws, goals, corners, cards, half-time lines, winning margins — on any of the 104 World Cup matches. Or stack picks into a parlay.",
  },
  {
    q: "What does it cost?",
    a: "It runs on Solana devnet, so the money is test USDC — free to mint. The platform takes 2% of winning payouts, withheld by the program when winners claim. That's the only fee.",
  },
];

/**
 * Two-column FAQ — sticky headline + intro on the left, accordion column
 * on the right. One row, no headline floating in space.
 */
export function FaqSection() {
  return (
    <div className="grid gap-12 lg:grid-cols-[1fr,1.4fr] lg:gap-16">
      <div className="lg:sticky lg:top-12 lg:self-start">
        <span className="text-xs font-bold uppercase tracking-[0.25em] text-punt-ink/50">
          Questions
        </span>
        <h2 className="mt-3 text-4xl font-black tracking-tight text-punt-ink sm:text-5xl">
          Asked,
          <br />
          answered.
        </h2>
        <p className="mt-5 max-w-md text-base font-medium text-punt-ink/60">
          The short answers to the most common questions about OpenCast. The
          full version lives in the docs.
        </p>
      </div>

      <div className="space-y-3">
        {ITEMS.map((it, i) => (
          <FaqRow key={i} q={it.q} a={it.a} defaultOpen={i === 0} />
        ))}
      </div>
    </div>
  );
}

function FaqRow({
  q,
  a,
  defaultOpen,
}: {
  q: string;
  a: string;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div
      className={`overflow-hidden rounded-3xl border bg-punt-paper transition-colors ${
        open ? "border-punt-ink/15" : "border-punt-ink/8 hover:border-punt-ink/15"
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
      >
        <span className="text-base font-bold text-punt-ink sm:text-lg">{q}</span>
        <span
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-pill transition-all ${
            open ? "rotate-180 bg-punt-lime" : "bg-punt-ink/5"
          }`}
        >
          <IconChevronDown size={18} color="#0A0A0A" />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <p className="px-6 pb-6 text-sm font-medium text-punt-ink/65 sm:text-base">
              {a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
