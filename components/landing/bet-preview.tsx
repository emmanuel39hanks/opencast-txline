"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { IconShield, IconCheck, IconClose } from "@/lib/icons";
import { TeamCircle } from "@/components/market/market-card";
import { SectionHeading } from "./how-it-works";
import { Reveal } from "./reveal";
import { cn } from "@/lib/utils";

/**
 * Interactive demo styled EXACTLY like the app's real market page: the
 * match header with flags + pool bar on the left, and a working clone of
 * the trade panel (components/market/market-actions.tsx) on the right —
 * pick a side at pool odds, set the amount with the same +$ chips, "buy",
 * watch it confirm, get the receipt.
 */
const YES_PCT = 62; // France
const HOME = "France";
const AWAY = "Spain";

type Step = "trade" | "confirming" | "done";

export function BetPreview() {
  const [step, setStep] = React.useState<Step>("trade");
  const [side, setSide] = React.useState<1 | 2>(1);
  const [amount, setAmount] = React.useState(10);

  const sidePct = side === 1 ? YES_PCT : 100 - YES_PCT;
  const sideLabel = side === 1 ? HOME : AWAY;
  // Same parimutuel maths as the real panel (2% fee).
  const vault = 220;
  const sidePool = vault * (sidePct / 100);
  const payout =
    amount > 0 ? (amount / (sidePool + amount)) * (vault + amount) * 0.98 : 0;
  const txHash = React.useMemo(() => mockTxHash(side, amount), [side, amount]);

  const buy = () => {
    setStep("confirming");
    setTimeout(() => setStep("done"), 1400);
  };
  const reset = () => {
    setStep("trade");
    setSide(1);
    setAmount(10);
  };

  return (
    <div>
      <SectionHeading
        eyebrow="Try it"
        title="The trade, exactly as it feels in the app."
        subtitle="This is the real trading panel — pick a side at pool odds, size it, send. Nothing here is a mock-up except the money."
      />

      <Reveal>
        <div className="grid gap-5 lg:grid-cols-[1.4fr,1fr]">
          {/* ── Market header — same as the real detail page ─────────── */}
          <div className="rounded-card border border-punt-ink/8 bg-punt-paper p-6">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-punt-ink/45">
              <span className="rounded-pill bg-punt-cream px-2 py-0.5">World Cup</span>
              <span>Jul 11</span>
              <span className="rounded-pill bg-punt-ink/8 px-2 py-0.5 text-punt-ink/60">
                Demo
              </span>
            </div>

            <h3 className="mt-3 text-2xl font-black leading-tight text-punt-ink sm:text-3xl">
              Will {HOME} beat {AWAY}?
            </h3>

            {/* Teams */}
            <div className="mt-5 flex items-center justify-center gap-6">
              <TeamSide name={HOME} />
              <span className="text-sm font-black text-punt-ink/30">VS</span>
              <TeamSide name={AWAY} />
            </div>

            {/* Live pool bar — identical language to the detail page */}
            <div className="mt-6">
              <div className="mb-1.5 flex justify-between text-xs font-bold">
                <span className="text-punt-ink">
                  {HOME} · {YES_PCT}%
                </span>
                <span className="text-punt-ink/50">
                  {AWAY} · {100 - YES_PCT}%
                </span>
              </div>
              <div className="flex h-3 overflow-hidden rounded-pill bg-punt-cream">
                <div className="h-full bg-punt-lime" style={{ width: `${YES_PCT}%` }} />
                <div className="h-full bg-rose-400" style={{ width: `${100 - YES_PCT}%` }} />
              </div>
              <div className="mt-2 text-xs font-medium text-punt-ink/50">
                ${vault.toFixed(2)} in the pool · odds move with the money
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-punt-ink/[0.06] pt-5 text-[11px] font-bold text-punt-ink/55">
              <span className="rounded-pill bg-punt-cream px-2.5 py-1">Locks at kickoff</span>
              <span className="rounded-pill bg-punt-cream px-2.5 py-1">Settles at full-time</span>
              <span className="rounded-pill bg-punt-lime px-2.5 py-1 text-punt-ink">
                Settled by TxLINE proof
              </span>
            </div>
          </div>

          {/* ── Trade panel — clone of the real one ──────────────────── */}
          <div className="rounded-card border border-punt-ink/8 bg-punt-paper p-5">
            <AnimatePresence mode="wait">
              {step === "trade" && (
                <motion.div
                  key="trade"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-3.5"
                >
                  {/* Buy / Sell tabs, like the real panel */}
                  <div className="flex items-center justify-between border-b border-punt-ink/8 pb-2.5">
                    <div className="flex items-center gap-4">
                      <span className="relative pb-1 text-sm font-bold text-punt-ink">
                        Buy
                        <span className="absolute -bottom-[11px] left-0 h-0.5 w-full rounded-pill bg-punt-ink" />
                      </span>
                      <span className="pb-1 text-sm font-bold text-punt-ink/40">Sell</span>
                    </div>
                    <span className="rounded-pill bg-punt-cream/70 px-2.5 py-1 text-[11px] font-bold text-punt-ink/60">
                      Market
                    </span>
                  </div>

                  {/* YES / NO price selector */}
                  <div className="grid grid-cols-2 gap-2">
                    <OutcomeButton
                      label={HOME}
                      cents={YES_PCT}
                      tone="yes"
                      selected={side === 1}
                      onClick={() => setSide(1)}
                    />
                    <OutcomeButton
                      label={AWAY}
                      cents={100 - YES_PCT}
                      tone="no"
                      selected={side === 2}
                      onClick={() => setSide(2)}
                    />
                  </div>

                  {/* Amount */}
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-punt-ink/50">
                        Amount
                      </span>
                      <div className="flex items-center gap-1 font-mono text-2xl font-black text-punt-ink">
                        <span className="text-punt-ink/40">$</span>
                        {amount}
                      </div>
                    </div>
                    <div className="mt-2 flex gap-1.5">
                      {[1, 5, 10, 100].map((a) => (
                        <button
                          key={a}
                          type="button"
                          onClick={() => setAmount((v) => v + a)}
                          className="h-8 flex-1 rounded-pill border border-punt-ink/10 bg-punt-paper text-xs font-bold text-punt-ink/70 transition-colors hover:bg-punt-ink/5"
                        >
                          +${a}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setAmount(10)}
                        className="h-8 rounded-pill border border-punt-ink/10 bg-punt-paper px-3 text-xs font-bold text-punt-ink/70 transition-colors hover:bg-punt-ink/5"
                      >
                        Reset
                      </button>
                    </div>
                  </div>

                  {/* Trade */}
                  <button
                    type="button"
                    onClick={buy}
                    className={cn(
                      "w-full rounded-pill py-3.5 text-base font-extrabold transition-transform hover:-translate-y-0.5",
                      side === 1
                        ? "bg-punt-lime text-punt-ink"
                        : "bg-rose-500 text-white",
                    )}
                  >
                    Buy {sideLabel}
                  </button>

                  <div className="flex items-center justify-between text-[11px] font-medium text-punt-ink/50">
                    <span>Payout if correct</span>
                    <span className="font-mono font-bold text-punt-ink/70">
                      ~${payout.toFixed(2)}
                    </span>
                  </div>
                </motion.div>
              )}

              {step === "confirming" && (
                <motion.div
                  key="confirming"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className="flex flex-col items-center justify-center gap-3 py-16"
                >
                  <Spinner />
                  <p className="text-sm font-bold text-punt-ink">Confirming…</p>
                  <p className="text-xs font-medium text-punt-ink/55">
                    One transaction on Solana devnet
                  </p>
                </motion.div>
              )}

              {step === "done" && (
                <motion.div
                  key="done"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className="space-y-3"
                >
                  <div className="rounded-2xl bg-punt-lime-soft p-4">
                    <div className="flex items-center gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-pill bg-punt-ink">
                        <IconCheck size={18} variant="Linear" color="#C9F468" />
                      </span>
                      <div>
                        <p className="text-sm font-extrabold text-punt-ink">
                          {sideLabel} · ${amount} USDC
                        </p>
                        <p className="text-[11px] font-medium text-punt-ink/60">
                          In the pool — pays ~${payout.toFixed(2)} if {sideLabel} wins
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 border-t border-punt-ink/10 pt-2.5 font-mono text-[10px] font-bold text-punt-ink/45">
                      tx {txHash}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-punt-cream/60 px-3.5 py-3 text-[11px] font-medium leading-relaxed text-punt-ink/60">
                    Full-time, TxLINE&apos;s score proof settles this on-chain —
                    winners claim their share of the pool. No admin, no button.
                  </div>

                  <Link
                    href="/verify/18237038"
                    className="flex items-center justify-center gap-1.5 pt-1 text-xs font-bold text-punt-ink/55 transition-colors hover:text-punt-ink"
                  >
                    <IconShield size={12} variant="Linear" color="#0A0A0A" />
                    See a real settlement receipt
                  </Link>

                  <button
                    type="button"
                    onClick={reset}
                    className="mx-auto flex items-center gap-1.5 text-xs font-bold text-punt-ink/40 hover:text-punt-ink/70"
                  >
                    <IconClose size={12} variant="Linear" />
                    Reset demo
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </Reveal>
    </div>
  );
}

// ─── Pieces (same visual language as the app) ──────────────────────────────

function TeamSide({ name }: { name: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <TeamCircle name={name} size={56} />
      <span className="text-sm font-bold text-punt-ink">{name}</span>
    </div>
  );
}

/** Identical styling to market-actions.tsx OutcomeButton. */
function OutcomeButton({
  label,
  cents,
  tone,
  selected,
  onClick,
}: {
  label: string;
  cents: number;
  tone: "yes" | "no";
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-0.5 rounded-2xl border-2 px-3 py-3 leading-tight transition-all",
        selected
          ? tone === "yes"
            ? "border-punt-lime bg-punt-lime text-punt-ink"
            : "border-rose-500 bg-rose-500 text-white"
          : "border-punt-ink/10 bg-punt-cream/40 text-punt-ink hover:border-punt-ink/25",
      )}
    >
      <span className="max-w-full truncate text-sm font-bold">{label}</span>
      <span
        className={cn(
          "font-mono text-[11px]",
          selected
            ? tone === "yes"
              ? "text-punt-ink/70"
              : "text-white/80"
            : "text-punt-ink/50",
        )}
      >
        {cents}¢
      </span>
    </button>
  );
}

function Spinner() {
  return (
    <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-punt-ink/15 border-t-punt-ink" />
  );
}

/** Deterministic mock hash so the receipt doesn't flicker between renders. */
function mockTxHash(side: 1 | 2, amount: number): string {
  let h = side * 7919 + amount * 104729;
  const chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let out = "";
  for (let i = 0; i < 20; i++) {
    h = (h * 48271) % 2147483647;
    out += chars[h % chars.length];
  }
  return `${out.slice(0, 8)}…${out.slice(-6)}`;
}
