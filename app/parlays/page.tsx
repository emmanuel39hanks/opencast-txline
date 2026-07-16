"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@/lib/wallet";
import { Skeleton } from "@/components/ui/skeleton";
import { teamFlagUrl } from "@/lib/teams";
import { formatUsdc } from "@/lib/utils";
import { IconArrowRight } from "@/lib/icons";

interface Leg {
  pick: string;
  home: string;
  away: string;
}
interface Ticket {
  betPda: string;
  stake: number;
  payout: number;
  legs: Leg[];
  chain: {
    evaluated: number;
    passed: number;
    settled: boolean;
    won: boolean;
    claimed: boolean;
  } | null;
}

export default function ParlaysPage() {
  const { authenticated, address, connect } = useWallet();
  const { data, isLoading } = useQuery({
    queryKey: ["parlays", address],
    queryFn: async () => {
      const r = await fetch(`/api/parlay?owner=${address}`);
      return r.json();
    },
    enabled: !!address,
    refetchInterval: 15000,
  });
  const tickets = (data?.tickets ?? []) as Ticket[];

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-punt-ink sm:text-3xl">
            My parlays
          </h1>
          <p className="mt-1 text-sm font-medium text-punt-ink/55">
            Fixed-odds tickets — one stake, all picks must hit.
          </p>
        </div>
        <Link
          href="/parlays/new"
          className="rounded-pill bg-punt-lime px-4 py-2.5 text-sm font-extrabold text-punt-ink transition-transform hover:-translate-y-0.5"
        >
          Build a parlay
        </Link>
      </div>

      {!authenticated ? (
        <div className="mt-8 rounded-card border border-punt-ink/8 bg-punt-paper p-10 text-center">
          <p className="text-sm font-medium text-punt-ink/60">
            Sign in to see your parlays.
          </p>
          <button
            type="button"
            onClick={() => connect()}
            className="mt-4 rounded-pill bg-punt-ink px-5 py-2.5 text-sm font-bold text-punt-paper"
          >
            Connect Wallet
          </button>
        </div>
      ) : isLoading ? (
        <div className="mt-6 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : tickets.length === 0 ? (
        <div className="mt-8 rounded-card border border-dashed border-punt-ink/15 bg-punt-paper p-12 text-center">
          <p className="text-base font-bold text-punt-ink">No parlays yet.</p>
          <Link
            href="/parlays/new"
            className="mt-3 inline-block rounded-pill bg-punt-lime px-5 py-2.5 text-sm font-extrabold text-punt-ink"
          >
            Build your first →
          </Link>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {tickets.map((t) => (
            <TicketRow key={t.betPda} t={t} />
          ))}
        </div>
      )}
    </div>
  );
}

function TicketRow({ t }: { t: Ticket }) {
  const mult = t.stake > 0 ? Math.round((t.payout / t.stake) * 10) / 10 : 0;
  const settled = t.chain?.settled;
  const won = t.chain?.won;
  const claimed = t.chain?.claimed;
  const status = settled
    ? won
      ? claimed
        ? { label: "Claimed", cls: "bg-punt-cream text-punt-ink/60" }
        : { label: "Won · claim", cls: "bg-punt-lime text-punt-ink" }
      : { label: "Lost", cls: "bg-rose-100 text-rose-600" }
    : { label: "Open", cls: "bg-punt-ink/8 text-punt-ink/60" };

  return (
    <Link
      href={`/parlay/${t.betPda}`}
      className="group flex items-center gap-4 rounded-2xl border border-punt-ink/8 bg-punt-paper p-4 transition-all hover:-translate-y-0.5 hover:shadow-[0_6px_24px_-12px_rgba(10,10,10,0.25)]"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="rounded-pill bg-punt-ink px-2 py-0.5 font-mono text-[11px] font-black text-punt-lime">
            {mult}× · {t.legs.length} legs
          </span>
          <span
            className={`rounded-pill px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${status.cls}`}
          >
            {status.label}
          </span>
        </div>
        <div className="mt-1.5 truncate text-sm font-bold text-punt-ink">
          {t.legs.map((l) => l.pick).join(" · ")}
        </div>
        <div className="mt-0.5 flex -space-x-1.5">
          {Array.from(new Set(t.legs.flatMap((l) => [l.home, l.away])))
            .slice(0, 6)
            .map((n, i) => {
              const f = teamFlagUrl(n);
              return f ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={f}
                  alt=""
                  className="h-4 w-4 rounded-full border border-punt-paper object-cover"
                />
              ) : null;
            })}
        </div>
      </div>
      <div className="text-right">
        <div className="font-mono text-sm font-black text-punt-ink">
          ${formatUsdc(t.stake)} → ${formatUsdc(t.payout)}
        </div>
        <span className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-punt-ink/50 group-hover:text-punt-ink">
          View <IconArrowRight size={12} variant="Linear" color="#0A0A0A" />
        </span>
      </div>
    </Link>
  );
}
