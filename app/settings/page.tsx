"use client";

import * as React from "react";
import { toast } from "sonner";
import { useWallet } from "@/lib/wallet";
import { useAppStore } from "@/lib/store";
import { formatMoney, shortAddress } from "@/lib/utils";
import { Avatar } from "@/components/shared/app-header";
import { IconCoin, IconArrowRight, IconLink } from "@/lib/icons";

/**
 * /settings — one calm column: account, test USDC, notifications.
 * No bento grid; each section is a flat card with hairline dividers,
 * actions right-aligned, full-dollar balances.
 */
export default function SettingsPage() {
  const {
    authenticated,
    connecting,
    address,
    usdcBalance,
    disconnect,
    refreshBalance,
  } = useWallet();
  const { notifications, setNotifications } = useAppStore();
  const [minting, setMinting] = React.useState(false);

  const mintTestUSDC = async () => {
    if (!address) return;
    setMinting(true);
    try {
      const r = await fetch("/api/faucet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: address }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      toast.success("Minted 1,000 test USDC");
      setTimeout(refreshBalance, 1500);
    } catch (e) {
      toast.error("Mint failed", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setMinting(false);
    }
  };

  const copyAddress = () => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    toast("Address copied");
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-punt-ink sm:text-3xl">
          Settings
        </h1>
        <p className="text-sm font-medium text-punt-ink/55">
          Your wallet, test USDC, and notifications.
        </p>
      </div>

      <div className="mt-8 space-y-5">
        {/* ── Account ─────────────────────────────────────────────── */}
        <Section title="Account">
          {connecting ? (
            <div className="flex items-center gap-4 px-5 py-4">
              <div className="h-11 w-11 animate-pulse rounded-full bg-punt-ink/[0.06]" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-40 animate-pulse rounded bg-punt-ink/[0.06]" />
                <div className="h-3 w-28 animate-pulse rounded bg-punt-ink/[0.06]" />
              </div>
            </div>
          ) : authenticated ? (
            <>
              <div className="flex flex-wrap items-center gap-4 px-5 py-4">
                <Avatar address={address} size={44} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-extrabold text-punt-ink">
                      {address ? shortAddress(address, 6) : "—"}
                    </span>
                    <button
                      type="button"
                      onClick={copyAddress}
                      className="rounded-pill bg-punt-ink/5 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-punt-ink/60 transition-colors hover:bg-punt-ink/10 hover:text-punt-ink"
                    >
                      Copy
                    </button>
                    {address && (
                      <a
                        href={`https://explorer.solana.com/address/${address}?cluster=devnet`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-pill bg-punt-ink/5 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-punt-ink/60 transition-colors hover:bg-punt-ink/10 hover:text-punt-ink"
                      >
                        <IconLink size={10} variant="Linear" color="#0A0A0A" />
                        Explorer
                      </a>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs font-medium text-punt-ink/55">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-punt-lime" />
                      Solana Devnet
                    </span>
                    <span className="text-punt-ink/25">·</span>
                    Embedded wallet
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-punt-ink/45">
                    USDC balance
                  </div>
                  <div className="font-mono text-lg font-extrabold tabular-nums text-punt-ink">
                    ${formatMoney(usdcBalance)}
                  </div>
                </div>
              </div>
              <div className="border-t border-punt-ink/[0.06] px-5 py-3">
                <button
                  type="button"
                  onClick={disconnect}
                  className="text-xs font-bold text-rose-600 transition-colors hover:text-rose-700"
                >
                  Disconnect wallet
                </button>
              </div>
            </>
          ) : (
            <p className="px-5 py-6 text-sm font-medium text-punt-ink/55">
              Not connected.
            </p>
          )}
        </Section>

        {/* ── Faucet ──────────────────────────────────────────────── */}
        <Section title="Test USDC" id="faucet">
          <div className="flex flex-wrap items-center gap-4 px-5 py-4">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-pill bg-punt-lime">
              <IconCoin size={18} variant="Linear" color="#0A0A0A" />
            </div>
            <p className="min-w-0 flex-1 text-sm font-medium leading-relaxed text-punt-ink/60">
              OpenCast runs on Solana devnet with a test USDC mint —{" "}
              <span className="font-bold text-punt-ink">1,000 USDC</span> lands
              in your wallet in seconds. No gas, no seed phrase.
            </p>
            <button
              type="button"
              onClick={mintTestUSDC}
              disabled={!authenticated || minting}
              className="inline-flex items-center gap-2 rounded-pill bg-punt-ink px-5 py-2.5 text-sm font-extrabold text-punt-paper transition-transform hover:-translate-y-0.5 disabled:opacity-50"
            >
              {minting ? "Minting…" : "Get 1,000 test USDC"}
              {!minting && (
                <IconArrowRight size={14} variant="Linear" color="#F2F2EE" />
              )}
            </button>
          </div>
        </Section>

        {/* ── Notifications ───────────────────────────────────────── */}
        <Section title="Notifications">
          <div className="px-5">
            <Toggle
              label="Trades on my markets"
              description="When someone bets on a market you created."
              checked={notifications.trades}
              onChange={(v) => setNotifications({ trades: v })}
            />
            <Toggle
              label="Market settlements"
              description="When a market you bet on settles and there's something to claim."
              checked={notifications.disputes}
              onChange={(v) => setNotifications({ disputes: v })}
            />
          </div>
        </Section>
      </div>
    </div>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────

function Section({
  title,
  children,
  id,
}: {
  title: string;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <section id={id}>
      <h2 className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wider text-punt-ink/45">
        {title}
      </h2>
      <div className="overflow-hidden rounded-card border border-punt-ink/8 bg-punt-paper">
        {children}
      </div>
    </section>
  );
}

// ─── Toggle ───────────────────────────────────────────────────────────────

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-punt-ink/[0.06] py-4 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-punt-ink">{label}</p>
        <p className="mt-0.5 text-xs font-medium text-punt-ink/55">
          {description}
        </p>
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        aria-pressed={checked}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
          checked ? "bg-punt-lime" : "bg-punt-ink/15"
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-punt-paper shadow transition-transform ${
            checked ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}
