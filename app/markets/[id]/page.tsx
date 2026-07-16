"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MarketActions } from "@/components/market/market-actions";
import { MatchPhaseBadge } from "@/components/market/market-card";
import { LiveMatchCard } from "@/components/market/live-match-card";
import { TxLineOddsStrip } from "@/components/market/txline-odds-strip";
import { RecentActivity } from "@/components/market/recent-activity";
import { OddsChart } from "@/components/market/odds-chart";
import { VerifiableResolutionCard } from "@/components/market/verifiable-resolution-card";
import { useMarket } from "@/lib/hooks/useMarket";
import { teamsFromMarket, teamFlagUrl } from "@/lib/teams";
import { formatUsdc } from "@/lib/utils";

export default function MarketDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  // Route key: marketPda for created markets, fixtureId for bare fixtures.
  const { data: market, isLoading, isError, refetch } = useMarket(params.id);

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-[1200px] space-y-4 px-4 py-6 sm:px-6 sm:py-8">
        <Skeleton className="h-8 w-2/3" />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-56 w-full" />
          </div>
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }
  if (isError || !market) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-16 sm:py-24">
        <div className="rounded-card border border-punt-ink/8 bg-punt-paper p-10 text-center">
          <p className="text-sm font-medium text-punt-ink/60">
            {isError ? "Couldn't load this market." : "Market not found."}
          </p>
          <div className="mt-5 flex justify-center gap-2">
            {isError && (
              <Button variant="outline" onClick={() => refetch()}>
                Retry
              </Button>
            )}
            <Button onClick={() => router.push("/markets")}>Back to markets</Button>
          </div>
        </div>
      </div>
    );
  }

  const { home, away } = teamsFromMarket(market);
  const homeFlag = teamFlagUrl(home);
  const awayFlag = teamFlagUrl(away);
  const yesPct = Math.round((market.priceYes ?? 0.5) * 100);
  const resolved = market.status === "RESOLVED";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const m = market as any;
  const kickoff = market.startTime ? new Date(market.startTime) : null;

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <button
        type="button"
        onClick={() => router.back()}
        className="inline-flex items-center gap-1.5 rounded-pill bg-punt-paper px-3 py-1.5 text-xs font-bold text-punt-ink/65 transition-colors hover:text-punt-ink"
      >
        <ArrowLeft className="h-3 w-3" /> Back
      </button>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Header card */}
          <div className="rounded-card border border-punt-ink/8 bg-punt-paper p-6">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-punt-ink/45">
              <span className="rounded-pill bg-punt-cream px-2 py-0.5">World Cup</span>
              {kickoff && (
                <span>
                  {kickoff.toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              )}
              {!m.marketPda ? (
                <span className="rounded-pill bg-punt-lime px-2 py-0.5 text-punt-ink">
                  Not yet created
                </span>
              ) : (
                <MatchPhaseBadge
                  phase={
                    market.matchState ??
                    (resolved ? "settled" : "upcoming")
                  }
                />
              )}
            </div>

            <h1 className="mt-3 text-2xl font-black leading-tight text-punt-ink sm:text-3xl">
              {market.question}
            </h1>

            {/* Teams */}
            {(home || away) && (
              <div className="mt-5 flex items-center justify-center gap-6">
                <TeamBadge name={home} flag={homeFlag} />
                <span className="text-sm font-black text-punt-ink/30">VS</span>
                <TeamBadge name={away} flag={awayFlag} />
              </div>
            )}

            {/* Live pool bar */}
            <div className="mt-6">
              <div className="mb-1.5 flex justify-between text-xs font-bold">
                <span className="text-punt-ink">{m.yesLabel ?? "Yes"} · {yesPct}%</span>
                <span className="text-punt-ink/50">
                  {m.noLabel ?? "No"} · {100 - yesPct}%
                </span>
              </div>
              <div className="flex h-3 overflow-hidden rounded-pill bg-punt-cream">
                <div className="h-full bg-punt-lime" style={{ width: `${yesPct}%` }} />
                <div className="h-full bg-rose-400" style={{ width: `${100 - yesPct}%` }} />
              </div>
              <div className="mt-2 text-xs font-medium text-punt-ink/50">
                ${formatUsdc(market.totalVolumeUsdc ?? 0)} in the pool
                {m.marketPda && (
                  <>
                    {" · "}
                    <span className="font-mono">
                      {m.marketPda.slice(0, 4)}…{m.marketPda.slice(-4)}
                    </span>
                  </>
                )}
              </div>

              {/* TxODDS reference line — the second TxLINE feed */}
              <TxLineOddsStrip fixtureId={market.id} />
            </div>
          </div>

          {m.marketPda && <OddsChart market={market} />}
          <LiveMatchCard fixtureId={market.id} settled={resolved} />
          {m.marketPda && (
            <RecentActivity
              marketPda={m.marketPda}
              yesLabel={m.yesLabel ?? "Yes"}
              noLabel={m.noLabel ?? "No"}
            />
          )}
          <VerifiableResolutionCard market={market} />
        </div>

        {/* Actions (desktop sticky) */}
        <div className="lg:block">
          <div className="lg:sticky lg:top-20">
            <MarketActions market={market} onChanged={() => refetch()} />
          </div>
        </div>
      </div>
    </div>
  );
}

function TeamBadge({ name, flag }: { name?: string; flag: string | null }) {
  if (!name) return null;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border border-punt-ink/10 bg-punt-cream">
        {flag ? (
          <Image
            src={flag}
            alt={name}
            width={56}
            height={56}
            className="h-full w-full object-cover"
            unoptimized
          />
        ) : (
          <span className="text-lg font-black text-punt-ink/40">
            {name.slice(0, 2).toUpperCase()}
          </span>
        )}
      </div>
      <span className="max-w-[6rem] truncate text-sm font-bold text-punt-ink">{name}</span>
    </div>
  );
}
