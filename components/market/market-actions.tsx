"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useWallet } from "@/lib/wallet";
import { useSettlement } from "@/lib/solana/client";
import { cn, formatMoney } from "@/lib/utils";
import { IconArrowRight, IconShield } from "@/lib/icons";
import type { Market } from "@/lib/types";

/**
 * The on-chain action panel for a market, styled like a modern prediction-market
 * ticket: pick YES / NO at live pool odds, stake test USDC, and settle / claim.
 * Create is permissionless (if the market doesn't exist yet). Every action is
 * signed by the embedded Solana wallet; settlement is a trustless TxLINE proof.
 */
export function MarketActions({
  market,
  onChanged,
}: {
  market: Market;
  onChanged?: () => void;
}) {
  const { authenticated, connecting, connect, address, usdcBalance, refreshBalance } =
    useWallet();
  const { createMarket, placePrediction, claim, readPosition } = useSettlement();
  const qc = useQueryClient();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [side, setSide] = React.useState<1 | 2>(1); // 1 YES · 2 NO
  const [amount, setAmount] = React.useState(50);
  const [mode, setMode] = React.useState<"buy" | "sell">("buy");

  const afterTx = React.useCallback(async () => {
    await new Promise((r) => setTimeout(r, 2500));
    refreshBalance();
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["market"] }),
      qc.invalidateQueries({ queryKey: ["markets"] }),
      qc.invalidateQueries({ queryKey: ["portfolio"] }),
    ]);
    onChanged?.();
  }, [qc, refreshBalance, onChanged]);

  const [position, setPosition] = React.useState<
    { yesAmount: number; noAmount: number; claimed: boolean } | null | undefined
  >(undefined);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const m = market as any;
  const created = Boolean(m.marketPda);
  const resolved = market.status === "RESOLVED";
  const outcome: string | undefined = m.finalOutcome;
  const yesPct = Math.round((market.priceYes ?? 0.5) * 100);
  const yesLabel = m.yesLabel ?? "Yes";
  const noLabel = m.noLabel ?? "No";
  const sidePct = side === 1 ? yesPct : 100 - yesPct;
  // Exact parimutuel payout: your stake joins the side pool, and if that side
  // wins you take stake/(sidePool+stake) of the grown vault, minus the 2% fee.
  const vault = market.totalVolumeUsdc ?? 0;
  const sidePool = vault * (sidePct / 100);
  const payout =
    amount > 0 ? (amount / (sidePool + amount)) * (vault + amount) * 0.98 : 0;

  React.useEffect(() => {
    if (!authenticated || !created || !m.marketPda) {
      setPosition(null);
      return;
    }
    let live = true;
    readPosition(m.marketPda).then((p) => live && setPosition(p));
    return () => {
      live = false;
    };
  }, [authenticated, created, m.marketPda, readPosition, busy]);

  const wonSide = outcome === "Yes" ? position?.yesAmount : position?.noAmount;
  const canClaim = resolved && !!position && !position.claimed && (wonSide ?? 0) > 0;
  const stake = (position?.yesAmount ?? 0) + (position?.noAmount ?? 0);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      toast.error((e as Error).message.slice(0, 120));
    } finally {
      setBusy(null);
    }
  };

  const faucet = () =>
    run("faucet", async () => {
      const r = await fetch("/api/faucet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: address }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      toast.success("Minted 1,000 test USDC");
      setTimeout(refreshBalance, 1500);
    });

  const doCreate = () =>
    run("create", async () => {
      // Open at TxODDS' line when one exists — the default market here is
      // the match winner, whose YES side is the home team.
      let openingYesPct: number | undefined;
      try {
        const r = await fetch(`/api/odds/${market.id}`);
        const line = (await r.json()) as {
          available: boolean;
          home?: string;
          line?: { home: number | null };
        };
        if (line.available && line.line?.home != null && line.home === yesLabel) {
          openingYesPct = line.line.home / 100;
        }
      } catch {
        /* 50/50 fallback */
      }
      const res = await createMarket({
        fixtureId: market.id,
        statKeyA: m.statKeyA,
        statKeyB: m.statKeyB,
        threshold: m.threshold,
        comparison: m.comparison,
        seedAmountUsdc: 20,
        openingYesPct,
      });
      await fetch("/api/markets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marketPda: res.market,
          fixtureId: market.id,
          statKeys: [m.statKeyA, m.statKeyB],
          question: market.question,
          yesLabel: m.yesLabel,
          noLabel: m.noLabel,
          creator: address,
        }),
      });
      toast.success("Market created on-chain — 20 USDC seeded");
      await afterTx();
    });

  const trade = () =>
    run("trade", async () => {
      await placePrediction({ market: m.marketPda, side, amountUsdc: amount });
      // Record for the activity feed / leaderboard — money truth stays on-chain.
      fetch("/api/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marketPda: m.marketPda,
          wallet: address,
          side,
          amountUsdc: amount,
        }),
      }).catch(() => {});
      toast.success(`${side === 1 ? yesLabel : noLabel} · ${amount} USDC`);
      await afterTx();
    });

  const settle = () =>
    run("settle", async () => {
      const r = await fetch("/api/settle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketPda: m.marketPda }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      toast.success(`Settled trustlessly: ${j.outcome === 1 ? yesLabel : noLabel} wins`);
      await afterTx();
    });

  const doClaim = () =>
    run("claim", async () => {
      await claim({ market: m.marketPda });
      toast.success("Winnings claimed");
      await afterTx();
    });

  if (connecting) {
    return (
      <Panel>
        <div className="h-12 animate-pulse rounded-2xl bg-punt-ink/[0.05]" />
        <div className="mt-4 h-24 animate-pulse rounded-2xl bg-punt-ink/[0.04]" />
        <div className="mt-4 h-12 animate-pulse rounded-pill bg-punt-ink/[0.05]" />
      </Panel>
    );
  }

  if (!authenticated) {
    return (
      <Panel>
        <p className="text-sm font-medium text-punt-ink/60">
          Sign in to predict, create markets, and claim.
        </p>
        <button
          type="button"
          onClick={() => connect()}
          className="mt-4 w-full rounded-pill bg-punt-ink py-3 text-sm font-extrabold text-punt-paper transition-transform hover:-translate-y-0.5"
        >
          Connect Wallet
        </button>
      </Panel>
    );
  }

  return (
    <Panel>
      {/* Balance + faucet */}
      <div className="flex items-center justify-between rounded-2xl bg-punt-cream/60 px-3.5 py-2.5">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-punt-ink/45">
            Balance
          </div>
          <div className="font-mono text-base font-extrabold text-punt-ink">
            ${formatMoney(usdcBalance)}
          </div>
        </div>
        <button
          type="button"
          onClick={faucet}
          disabled={busy === "faucet"}
          className="rounded-pill border border-punt-ink/15 bg-punt-paper px-3.5 py-1.5 text-xs font-bold text-punt-ink transition-colors hover:bg-punt-ink/5 disabled:opacity-50"
        >
          {busy === "faucet" ? "Minting…" : "Get test USDC"}
        </button>
      </div>

      {!created ? (
        <div className="mt-4">
          <p className="text-xs font-medium leading-relaxed text-punt-ink/60">
            No one has created this market yet. Seed it with 20 USDC and it goes
            live on-chain — permissionless.
          </p>
          <button
            type="button"
            onClick={doCreate}
            disabled={busy === "create"}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-pill bg-punt-lime py-3.5 text-base font-extrabold text-punt-ink transition-transform hover:-translate-y-0.5 disabled:opacity-50"
          >
            {busy === "create" ? "Creating on-chain…" : "Create this market"}
            <IconArrowRight size={16} variant="Linear" color="#0A0A0A" />
          </button>
        </div>
      ) : resolved ? (
        <div className="mt-4 space-y-3">
          <div className="rounded-2xl bg-punt-ink p-4 text-center text-punt-paper">
            <div className="text-[10px] font-bold uppercase tracking-wider text-punt-paper/55">
              Settled trustlessly
            </div>
            <div className="mt-1 text-xl font-black">
              {outcome === "Yes" ? yesLabel : noLabel} won
            </div>
          </div>

          {position === undefined ? (
            <div className="h-12 w-full animate-pulse rounded-pill bg-punt-ink/5" />
          ) : canClaim ? (
            <button
              type="button"
              onClick={doClaim}
              disabled={busy === "claim"}
              className="w-full rounded-pill bg-punt-lime py-3.5 text-base font-extrabold text-punt-ink transition-transform hover:-translate-y-0.5 disabled:opacity-50"
            >
              {busy === "claim" ? "Claiming…" : "Claim winnings"}
            </button>
          ) : position?.claimed ? (
            <div className="rounded-2xl bg-punt-cream/60 py-3 text-center text-sm font-bold text-punt-ink/60">
              Winnings claimed ✓
            </div>
          ) : position && stake > 0 ? (
            <div className="rounded-2xl bg-rose-50 py-3 text-center text-sm font-bold text-rose-600">
              Your side didn&apos;t win this one.
            </div>
          ) : (
            <div className="rounded-2xl bg-punt-cream/60 py-3 text-center text-sm font-medium text-punt-ink/55">
              You didn&apos;t back this market.
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4 space-y-3.5">
          {/* Buy / Sell */}
          <div className="flex items-center justify-between border-b border-punt-ink/8 pb-2.5">
            <div className="flex items-center gap-4">
              {(["buy", "sell"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setMode(t)}
                  className={cn(
                    "relative pb-1 text-sm font-bold capitalize transition-colors",
                    mode === t
                      ? "text-punt-ink"
                      : "text-punt-ink/40 hover:text-punt-ink/70",
                  )}
                >
                  {t}
                  {mode === t && (
                    <span className="absolute -bottom-[11px] left-0 h-0.5 w-full rounded-pill bg-punt-ink" />
                  )}
                </button>
              ))}
            </div>
            <span className="rounded-pill bg-punt-cream/70 px-2.5 py-1 text-[11px] font-bold text-punt-ink/60">
              Market
            </span>
          </div>

          {mode === "sell" ? (
            <div className="space-y-3">
              {stake > 0 ? (
                <div className="overflow-hidden rounded-2xl border border-punt-ink/8">
                  <div className="border-b border-punt-ink/8 bg-punt-cream/50 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-punt-ink/45">
                    Your ticket
                  </div>
                  <div className="divide-y divide-punt-ink/[0.05]">
                    {(position?.yesAmount ?? 0) > 0 && (
                      <SellRow
                        label={yesLabel}
                        tone="yes"
                        stake={position!.yesAmount}
                        pct={yesPct}
                      />
                    )}
                    {(position?.noAmount ?? 0) > 0 && (
                      <SellRow
                        label={noLabel}
                        tone="no"
                        stake={position!.noAmount}
                        pct={100 - yesPct}
                      />
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl bg-punt-cream/60 p-4 text-center text-sm font-medium text-punt-ink/55">
                  You don&apos;t hold a position here yet.
                </div>
              )}
              <div className="flex items-start gap-2.5 rounded-2xl bg-punt-cream/60 p-3.5 text-[11px] font-medium leading-relaxed text-punt-ink/60">
                <IconShield size={14} variant="Linear" color="#0A0A0A" />
                <span>
                  <span className="font-bold text-punt-ink">
                    Bets ride to settlement.
                  </span>{" "}
                  Stakes pool together and pay out pro-rata the moment the match
                  settles against TxLINE&apos;s proof — no order book, nothing to
                  sell early.
                </span>
              </div>
            </div>
          ) : (
            <>
              {/* YES / NO price selector */}
              <div className="grid grid-cols-2 gap-2">
                <OutcomeButton
                  label={yesLabel}
                  cents={yesPct}
                  tone="yes"
                  selected={side === 1}
                  onClick={() => setSide(1)}
                />
                <OutcomeButton
                  label={noLabel}
                  cents={100 - yesPct}
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
                    <input
                      type="text"
                      inputMode="decimal"
                      value={amount}
                      onChange={(e) => {
                        const n = Number(e.target.value.replace(/[^0-9.]/g, ""));
                        setAmount(Number.isFinite(n) ? Math.max(0, n) : 0);
                      }}
                      className="w-24 bg-transparent text-right outline-none"
                    />
                  </div>
                </div>
                <div className="mt-2 flex gap-1.5">
                  {[1, 5, 10, 100].map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => setAmount((v) => Math.round((v + a) * 100) / 100)}
                      className="h-8 flex-1 rounded-pill border border-punt-ink/10 bg-punt-paper text-xs font-bold text-punt-ink/70 transition-colors hover:bg-punt-ink/5"
                    >
                      +${a}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setAmount(Math.floor(usdcBalance))}
                    className="h-8 rounded-pill border border-punt-ink/10 bg-punt-paper px-3 text-xs font-bold text-punt-ink/70 transition-colors hover:bg-punt-ink/5"
                  >
                    Max
                  </button>
                </div>
              </div>

              {/* Hedge warning — backing both sides guarantees a fee-sized loss */}
              {position &&
                ((side === 1 && position.noAmount > 0) ||
                  (side === 2 && position.yesAmount > 0)) && (
                  <div className="rounded-2xl bg-amber-50 px-3.5 py-2.5 text-[11px] font-medium leading-relaxed text-amber-800">
                    <span className="font-bold">
                      You already hold $
                      {formatMoney(side === 1 ? position.noAmount : position.yesAmount)}{" "}
                      on {side === 1 ? noLabel : yesLabel}.
                    </span>{" "}
                    Backing both sides of the same market locks in the 2% fee
                    as a guaranteed loss.
                  </div>
                )}

              {/* Trade */}
              <button
                type="button"
                onClick={trade}
                disabled={!!busy || amount <= 0}
                className={cn(
                  "w-full rounded-pill py-3.5 text-base font-extrabold transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45",
                  side === 1
                    ? "bg-punt-lime text-punt-ink"
                    : "bg-rose-500 text-white",
                )}
              >
                {busy === "trade"
                  ? "Confirming…"
                  : `Buy ${side === 1 ? yesLabel : noLabel}`}
              </button>

              <div className="flex items-center justify-between text-[11px] font-medium text-punt-ink/50">
                <span>Payout if correct</span>
                <span className="font-mono font-bold text-punt-ink/70">
                  ~${payout.toFixed(2)}
                </span>
              </div>

              {/* Settle (keeper) */}
              <button
                type="button"
                onClick={settle}
                disabled={busy === "settle"}
                className="flex w-full items-center justify-center gap-2 rounded-pill border border-punt-ink/15 bg-punt-paper py-2.5 text-sm font-bold text-punt-ink transition-colors hover:bg-punt-ink/5 disabled:opacity-50"
              >
                <IconShield size={14} variant="Linear" color="#0A0A0A" />
                {busy === "settle"
                  ? "Settling via TxLINE proof…"
                  : "Settle now (match ended)"}
              </button>
            </>
          )}
        </div>
      )}

      <Link
        href={m.marketPda ? `/verify/${market.id}?m=${m.marketPda}` : `/verify/${market.id}`}
        className="mt-3.5 flex items-center justify-center gap-1.5 text-xs font-bold text-punt-ink/55 transition-colors hover:text-punt-ink"
      >
        <IconShield size={12} variant="Linear" color="#0A0A0A" />
        Verify the TxLINE proof
      </Link>
    </Panel>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-card border border-punt-ink/8 bg-punt-paper p-5">
      {children}
    </div>
  );
}

/** One held side in the sell tab: stake · current odds · projected payout. */
function SellRow({
  label,
  tone,
  stake,
  pct,
}: {
  label: string;
  tone: "yes" | "no";
  stake: number;
  pct: number;
}) {
  const toWin = pct > 0 ? (stake / (pct / 100)) * 0.98 : 0;
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <span
        className={cn(
          "rounded-pill px-2.5 py-1 text-xs font-extrabold",
          tone === "yes"
            ? "bg-punt-lime-soft text-punt-ink"
            : "bg-rose-100 text-rose-700",
        )}
      >
        {label}
      </span>
      <span className="text-right">
        <span className="block font-mono text-sm font-extrabold tabular-nums text-punt-ink">
          ${formatMoney(stake)}
        </span>
        <span className="block text-[10px] font-bold text-punt-ink/45">
          now {pct}¢ · to win ~${formatMoney(toWin)}
        </span>
      </span>
    </div>
  );
}

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
