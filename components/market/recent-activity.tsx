"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Avatar } from "@/components/shared/app-header";
import { formatMoney, formatTimeAgo, shortAddress, cn } from "@/lib/utils";

interface TradeRow {
  wallet: string;
  side: number;
  amountUsdc: number;
  ts: string;
}

/**
 * Recent activity on a market — who backed which side, for how much, when.
 * Client-reported after each confirmed bet; renders nothing until the market
 * has trades.
 */
export function RecentActivity({
  marketPda,
  yesLabel,
  noLabel,
}: {
  marketPda: string;
  yesLabel: string;
  noLabel: string;
}) {
  const { data } = useQuery<TradeRow[]>({
    queryKey: ["trades", marketPda],
    refetchInterval: 20_000,
    queryFn: async () => {
      const r = await fetch(`/api/trades?market=${marketPda}`);
      if (!r.ok) return [];
      const j = (await r.json()) as { trades?: TradeRow[] };
      return j.trades ?? [];
    },
  });

  const trades = data ?? [];
  if (trades.length === 0) return null;

  return (
    <div className="rounded-card border border-punt-ink/8 bg-punt-paper p-5">
      <div className="text-[11px] font-bold uppercase tracking-wider text-punt-ink/45">
        Recent activity
      </div>
      <div className="mt-3 space-y-1">
        {trades.map((t, i) => (
          <div
            key={`${t.wallet}-${t.ts}-${i}`}
            className="flex items-center gap-3 rounded-xl px-2 py-1.5 text-sm hover:bg-punt-cream/40"
          >
            <Avatar address={t.wallet} size={22} />
            <span className="font-mono text-xs font-bold text-punt-ink/60">
              {shortAddress(t.wallet, 4)}
            </span>
            <span className="text-punt-ink/40">backed</span>
            <span
              className={cn(
                "rounded-pill px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide",
                t.side === 1
                  ? "bg-punt-lime-soft text-punt-ink"
                  : "bg-rose-100 text-rose-700",
              )}
            >
              {t.side === 1 ? yesLabel : noLabel}
            </span>
            <span className="font-mono text-sm font-extrabold tabular-nums text-punt-ink">
              ${formatMoney(t.amountUsdc)}
            </span>
            <span className="ml-auto text-[11px] font-medium text-punt-ink/35">
              {formatTimeAgo(t.ts)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
