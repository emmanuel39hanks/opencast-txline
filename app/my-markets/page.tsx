"use client";

import * as React from "react";
import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";
import { useMarkets } from "@/lib/hooks/useMarkets";
import { useWallet } from "@/lib/wallet";
import { MarketCard } from "@/components/market/market-card";
import {
  IconWallet,
  IconArrowRight,
  IconTrendUp,
} from "@/lib/icons";
import { cn } from "@/lib/utils";
import type { Market } from "@/lib/types";

type Tab = "active" | "resolved";

export default function MyMarketsPage() {
  const { authenticated, connecting, address } = useWallet();
  const { login } = usePrivy();
  const [tab, setTab] = React.useState<Tab>("active");

  const { data, isLoading, isError, refetch } = useMarkets(
    {},
    { creator: address ?? undefined, enabled: authenticated },
  );

  if (connecting) {
    return (
      <div className="mx-auto w-full max-w-[1440px] px-4 py-8 sm:px-6">
        <div className="h-8 w-44 animate-pulse rounded-pill bg-punt-ink/[0.05]" />
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[220px] animate-pulse rounded-3xl bg-punt-ink/[0.04]" />
          ))}
        </div>
      </div>
    );
  }
  if (!authenticated) {
    return <SignInPanel onSignIn={login} />;
  }

  const all = data ?? [];
  const groups: Record<Tab, Market[]> = {
    active: all.filter((m) => m.status === "ACTIVE"),
    resolved: all.filter((m) => m.status !== "ACTIVE"),
  };

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 sm:py-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-punt-ink sm:text-3xl">
          My markets
        </h1>
        <p className="text-sm font-medium text-punt-ink/55">
          Markets you&apos;ve created on-chain — track their pools and
          settlement status.
        </p>
      </div>

      {isError ? (
        <ErrorPanel onRetry={refetch} />
      ) : (
        <>
          {/* Tabs */}
          <div className="mt-8 flex flex-wrap items-center gap-2">
            <TabPill
              active={tab === "active"}
              onClick={() => setTab("active")}
              label="Active"
              count={groups.active.length}
            />
            <TabPill
              active={tab === "resolved"}
              onClick={() => setTab("resolved")}
              label="Resolved"
              count={groups.resolved.length}
            />
          </div>

          <div className="mt-5">
            {isLoading ? (
              <GridSkeleton />
            ) : groups[tab].length === 0 ? (
              <EmptyPanel tab={tab} />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {groups[tab].map((m) => (
                  <MarketCard key={(m as {slug?: string}).slug ?? m.id} market={m} />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Tab pill ─────────────────────────────────────────────────────────────

function TabPill({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-pill px-4 py-2.5 text-sm font-bold transition-colors",
        active
          ? "bg-punt-ink text-punt-paper"
          : "bg-transparent text-punt-ink/60 hover:bg-punt-ink/5 hover:text-punt-ink",
      )}
    >
      {label}
      <span
        className={cn(
          "rounded-pill px-2 py-0.5 text-[10px] tabular-nums",
          active ? "bg-punt-paper/15" : "bg-punt-ink/5 text-punt-ink/60",
        )}
      >
        {count}
      </span>
    </button>
  );
}


// ─── States ───────────────────────────────────────────────────────────────

function SignInPanel({ onSignIn }: { onSignIn: () => void }) {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-20 sm:py-28">
      <div className="rounded-card border border-punt-ink/8 bg-punt-paper p-10 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-pill bg-punt-lime">
          <IconWallet size={24} variant="Linear" color="#0A0A0A" />
        </div>
        <h1 className="mt-6 text-2xl font-bold tracking-tight text-punt-ink sm:text-3xl">
          Sign in to see your markets
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm font-medium text-punt-ink/60">
          The markets you&apos;ve created, their pools, and how they settled —
          all in one place.
        </p>
        <button
          type="button"
          onClick={onSignIn}
          className="mt-7 rounded-pill bg-punt-ink px-7 py-3 text-base font-extrabold text-punt-paper transition-transform hover:-translate-y-0.5"
        >
          Connect Wallet
        </button>
      </div>
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="h-[230px] animate-pulse rounded-3xl border border-punt-ink/8 bg-punt-ink/[0.03]"
        />
      ))}
    </div>
  );
}

function EmptyPanel({ tab }: { tab: Tab }) {
  const copy: Record<Tab, { title: string; body: string }> = {
    active: {
      title: "No active markets yet.",
      body: "Spin up a market and it'll show here while it's live.",
    },
    resolved: {
      title: "No resolved markets yet.",
      body: "Once your markets settle, they land here — ready to claim.",
    },
  };
  const { title, body } = copy[tab];
  return (
    <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-punt-ink/15 bg-punt-paper p-12 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-pill bg-punt-lime">
        <IconTrendUp size={22} variant="Linear" color="#0A0A0A" />
      </div>
      <p className="text-base font-bold text-punt-ink">{title}</p>
      <p className="max-w-sm text-sm font-medium text-punt-ink/55">{body}</p>
      <Link
        href="/create"
        className="mt-2 inline-flex items-center gap-1.5 rounded-pill bg-punt-lime px-5 py-2.5 text-sm font-extrabold text-punt-ink transition-transform hover:-translate-y-0.5"
      >
        Create a market
        <IconArrowRight size={14} variant="Linear" color="#0A0A0A" />
      </Link>
    </div>
  );
}

function ErrorPanel({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="mt-8 flex flex-col items-center gap-3 rounded-card border border-dashed border-rose-200 bg-rose-50 p-12 text-center">
      <p className="text-base font-bold text-rose-700">
        Couldn&apos;t load your markets.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-pill bg-punt-ink px-4 py-2 text-sm font-bold text-punt-paper"
      >
        Retry
      </button>
    </div>
  );
}
