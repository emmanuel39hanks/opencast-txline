"use client";

import * as React from "react";
import Link from "next/link";
import { useTopCreators, useTopTraders } from "@/lib/hooks/useUsers";
import { Avatar } from "@/components/shared/app-header";
import {
  IconTrendUp,
  IconStar,
  IconArrowRight,
} from "@/lib/icons";
import { cn, formatPercent, formatUsdc, shortAddress } from "@/lib/utils";
import type { User } from "@/lib/types";

type Tab = "creators" | "traders";

/**
 * /leaderboard — Top creators (by markets posted) and top traders (by total
 * volume), in the Punt brand language. Pill tabs, a ranked card list with
 * medallion rank chips for the top three, and watercolour avatars matching
 * the rest of the app.
 */
export default function LeaderboardPage() {
  const [tab, setTab] = React.useState<Tab>("creators");
  const creators = useTopCreators();
  const traders = useTopTraders();

  const creatorRows = creators.data ?? [];
  const traderRows = traders.data ?? [];

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 sm:py-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-punt-ink sm:text-3xl">
          Leaderboard
        </h1>
        <p className="text-sm font-medium text-punt-ink/55">
          Top creators by markets posted, top traders by total volume.
        </p>
      </div>

      {/* Tabs */}
      <div className="mt-7 flex flex-wrap items-center gap-2">
        <TabPill
          active={tab === "creators"}
          onClick={() => setTab("creators")}
          label="Top creators"
          count={creatorRows.length}
        />
        <TabPill
          active={tab === "traders"}
          onClick={() => setTab("traders")}
          label="Top traders"
          count={traderRows.length}
        />
      </div>

      <div className="mt-6">
        {tab === "creators" ? (
          <LeaderList
            rows={creatorRows}
            isLoading={creators.isLoading}
            kind="creators"
          />
        ) : (
          <LeaderList
            rows={traderRows}
            isLoading={traders.isLoading}
            kind="traders"
          />
        )}
      </div>
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
  count?: number;
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
      {typeof count === "number" && count > 0 && (
        <span
          className={cn(
            "rounded-pill px-2 py-0.5 text-[10px] tabular-nums",
            active ? "bg-punt-paper/15" : "bg-punt-ink/5 text-punt-ink/60",
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

// ─── List ─────────────────────────────────────────────────────────────────

function LeaderList({
  rows,
  isLoading,
  kind,
}: {
  rows: User[];
  isLoading: boolean;
  kind: Tab;
}) {
  if (isLoading) return <ListSkeleton />;
  if (rows.length === 0) return <EmptyPanel kind={kind} />;

  return (
    <div className="divide-y divide-punt-ink/8 overflow-hidden rounded-card border border-punt-ink/8 bg-punt-paper">
      {rows.map((u, i) => (
        <LeaderRow key={u.id ?? u.walletAddr} user={u} rank={i + 1} kind={kind} />
      ))}
    </div>
  );
}

function LeaderRow({
  user,
  rank,
  kind,
}: {
  user: User;
  rank: number;
  kind: Tab;
}) {
  return (
    <Link
      href={`/profile/${user.walletAddr}`}
      className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-punt-ink/[0.03] sm:gap-4 sm:px-5 sm:py-4"
    >
      <RankBadge rank={rank} />
      <Avatar address={user.walletAddr} size={40} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-bold text-punt-ink sm:text-base">
          {user.displayName || shortAddress(user.walletAddr, 4)}
        </div>
        <div className="truncate font-mono text-[11px] font-medium text-punt-ink/45">
          {shortAddress(user.walletAddr, 4)}
        </div>
      </div>

      {kind === "creators" ? (
        <div className="flex items-center gap-2 sm:gap-3">
          <StatPill
            value={formatPercent(user.accuracy ?? 0, 0)}
            label="settled"
            muted
          />
          <StatBlock
            value={`${user.marketsCreated ?? 0}`}
            label="markets"
          />
        </div>
      ) : (
        <StatBlock
          value={`$${formatUsdc(user.totalVolumeUsdc ?? 0)}`}
          label="volume"
        />
      )}

      <IconArrowRight
        size={14}
        variant="Linear"
        color="#0A0A0A"
        className="ml-1 shrink-0 opacity-30"
      />
    </Link>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const tone =
    rank === 1
      ? "bg-punt-lime text-punt-ink"
      : rank === 2
        ? "bg-punt-lavender text-punt-ink"
        : rank === 3
          ? "bg-punt-peach text-punt-ink"
          : "bg-punt-ink/5 text-punt-ink/55";
  return (
    <span
      className={cn(
        "grid h-8 w-8 shrink-0 place-items-center rounded-pill text-sm font-extrabold tabular-nums",
        tone,
      )}
    >
      {rank}
    </span>
  );
}

function StatBlock({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-right">
      <div className="text-sm font-extrabold tabular-nums text-punt-ink sm:text-base">
        {value}
      </div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-punt-ink/45">
        {label}
      </div>
    </div>
  );
}

function StatPill({
  value,
  label,
  muted,
}: {
  value: string;
  label: string;
  muted?: boolean;
}) {
  return (
    <span
      className={cn(
        "hidden items-center gap-1 rounded-pill px-2.5 py-1 text-xs font-bold sm:inline-flex",
        muted ? "bg-punt-ink/5 text-punt-ink/65" : "bg-punt-lime-soft text-punt-ink",
      )}
    >
      {value}
      <span className="text-[10px] font-bold uppercase tracking-wider text-punt-ink/40">
        {label}
      </span>
    </span>
  );
}

// ─── States ───────────────────────────────────────────────────────────────

function ListSkeleton() {
  return (
    <div className="divide-y divide-punt-ink/8 overflow-hidden rounded-card border border-punt-ink/8 bg-punt-paper">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-4">
          <div className="h-8 w-8 shrink-0 animate-pulse rounded-pill bg-punt-ink/[0.06]" />
          <div className="h-10 w-10 shrink-0 animate-pulse rounded-pill bg-punt-ink/[0.06]" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-40 animate-pulse rounded-pill bg-punt-ink/[0.06]" />
            <div className="h-2.5 w-24 animate-pulse rounded-pill bg-punt-ink/[0.04]" />
          </div>
          <div className="h-8 w-16 animate-pulse rounded-pill bg-punt-ink/[0.06]" />
        </div>
      ))}
    </div>
  );
}

function EmptyPanel({ kind }: { kind: Tab }) {
  const isCreators = kind === "creators";
  return (
    <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-punt-ink/15 bg-punt-paper p-12 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-pill bg-punt-lime">
        {isCreators ? (
          <IconStar size={22} variant="Linear" color="#0A0A0A" />
        ) : (
          <IconTrendUp size={22} variant="Linear" color="#0A0A0A" />
        )}
      </div>
      <p className="text-base font-bold text-punt-ink">
        {isCreators
          ? "No creators ranked yet."
          : "No traders ranked yet."}
      </p>
      <p className="max-w-sm text-sm font-medium text-punt-ink/55">
        {isCreators
          ? "Be the first — spin up a market and you'll show up here."
          : "Place the first prediction and climb the board by volume."}
      </p>
      <Link
        href={isCreators ? "/create" : "/markets"}
        className="mt-2 inline-flex items-center gap-1.5 rounded-pill bg-punt-lime px-5 py-2.5 text-sm font-extrabold text-punt-ink transition-transform hover:-translate-y-0.5"
      >
        {isCreators ? "Create a market" : "Browse markets"}
        <IconArrowRight size={14} variant="Linear" color="#0A0A0A" />
      </Link>
    </div>
  );
}
