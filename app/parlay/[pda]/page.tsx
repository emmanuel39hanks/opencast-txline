"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { BetTypeIcon } from "@/components/market/bet-type-icon";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/lib/wallet";
import { useSettlement } from "@/lib/solana/client";
import { teamFlagUrl } from "@/lib/teams";
import { formatUsdc } from "@/lib/utils";
import { IconShield } from "@/lib/icons";

interface Leg {
  betType: string;
  betTypeLabel: string;
  pick: string;
  home: string;
  away: string;
  /** Off-chain preview from the leg's own settled market: proof already in. */
  result?: "hit" | "miss" | null;
}
interface Chain {
  stake: number;
  payout: number;
  evaluated: number;
  passed: number;
  settled: boolean;
  won: boolean;
  claimed: boolean;
}

export default function ParlayTicketPage() {
  const { pda } = useParams<{ pda: string }>();
  const router = useRouter();
  const { address } = useWallet();
  const { claimParlay } = useSettlement();
  const [busy, setBusy] = React.useState<null | "settle" | "claim">(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["parlay", pda],
    queryFn: async () => {
      const r = await fetch(`/api/parlay/${pda}`);
      if (!r.ok) throw new Error("not found");
      return r.json();
    },
    refetchInterval: 15000,
  });

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-4 px-4 py-8 sm:px-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (isError || !data?.betPda) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-16 text-center">
        <p className="text-sm font-medium text-punt-ink/60">Ticket not found.</p>
        <Button className="mt-4" onClick={() => router.push("/markets")}>
          Back to markets
        </Button>
      </div>
    );
  }

  const legs = (data.legs ?? []) as Leg[];
  const chain = (data.chain ?? null) as Chain | null;
  const stake = chain?.stake ?? data.stake ?? 0;
  const payout = chain?.payout ?? data.payout ?? 0;
  const mult = stake > 0 ? Math.round((payout / stake) * 10) / 10 : 0;
  const settled = chain?.settled ?? data.settled;
  const won = chain?.won ?? data.won;
  const claimed = chain?.claimed ?? false;
  const isOwner = !!address && address === data.owner;
  const canClaim = settled && won && !claimed && isOwner;
  const legState = (i: number): "won" | "lost" | "proven" | "pending" => {
    const ev = chain ? (chain.evaluated >> i) & 1 : 0;
    const pa = chain ? (chain.passed >> i) & 1 : 0;
    if (settled) return pa ? "won" : "lost";
    if (ev) return "proven";
    // The leg's underlying market may already be settled by its own proof
    // even though the ticket only finalizes once every match has ended.
    if (legs[i]?.result === "hit") return "won";
    if (legs[i]?.result === "miss") return "lost";
    return "pending";
  };

  const settle = async () => {
    setBusy("settle");
    try {
      const r = await fetch("/api/parlay/settle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ betPda: pda }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      toast.success(j.won ? "Parlay hit — you won!" : "Parlay settled");
      setTimeout(() => refetch(), 2000);
    } catch (e) {
      toast.error((e as Error).message.slice(0, 140));
    } finally {
      setBusy(null);
    }
  };

  const claim = async () => {
    setBusy("claim");
    try {
      await claimParlay({ bet: pda, id: data.idSeed });
      toast.success("Winnings claimed");
      setTimeout(() => refetch(), 2500);
    } catch (e) {
      toast.error((e as Error).message.slice(0, 140));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5 px-4 py-6 sm:px-6 sm:py-8">
      <button
        type="button"
        onClick={() => router.back()}
        className="inline-flex items-center gap-1.5 rounded-pill bg-punt-paper px-3 py-1.5 text-xs font-bold text-punt-ink/65 transition-colors hover:text-punt-ink"
      >
        <ArrowLeft className="h-3 w-3" /> Back
      </button>

      {/* Ticket header */}
      <div className="rounded-card border border-punt-ink/8 bg-punt-paper p-6">
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-punt-ink/45">
          <span className="rounded-pill bg-punt-ink px-2.5 py-1 text-punt-lime">
            Parlay · {legs.length} picks
          </span>
          {settled && (
            <span
              className={`rounded-pill px-2 py-0.5 ${
                won ? "bg-punt-lime text-punt-ink" : "bg-rose-100 text-rose-600"
              }`}
            >
              {won ? "Won ✓" : "Lost"}
            </span>
          )}
        </div>

        <div className="mt-4 flex items-end justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-punt-ink/45">
              Stake
            </div>
            <div className="font-mono text-2xl font-black text-punt-ink">
              ${formatUsdc(stake)}
            </div>
          </div>
          <div className="text-2xl font-black text-punt-ink/30">×{mult}</div>
          <div className="text-right">
            <div className="text-[11px] font-bold uppercase tracking-wider text-punt-ink/45">
              {settled ? (won ? "Payout" : "Lost") : "To win"}
            </div>
            <div className="font-mono text-2xl font-black text-punt-ink">
              ${formatUsdc(payout)}
            </div>
          </div>
        </div>
      </div>

      {/* Legs */}
      <div className="rounded-card border border-punt-ink/8 bg-punt-paper p-5">
        <div className="mb-3 text-xs font-bold uppercase tracking-wider text-punt-ink/50">
          The picks · all must hit
        </div>
        <div className="space-y-2">
          {legs.map((l, i) => {
            const st = legState(i);
            return (
              <div
                key={i}
                className="flex items-center gap-3 rounded-2xl bg-punt-cream/50 px-3.5 py-3"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-punt-ink text-punt-paper">
                  <BetTypeIcon type={l.betType} size={17} className="text-punt-lime" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-punt-ink">{l.pick}</div>
                  <div className="flex items-center gap-1.5 truncate text-[11px] font-medium text-punt-ink/50">
                    <Flag name={l.home} />
                    {l.home} v {l.away}
                    <span className="text-punt-ink/25">·</span>
                    {l.betTypeLabel}
                  </div>
                </div>
                <LegStatus state={st} />
              </div>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="rounded-card border border-punt-ink/8 bg-punt-paper p-5">
        {!settled ? (
          <button
            type="button"
            onClick={settle}
            disabled={busy === "settle"}
            className="flex w-full items-center justify-center gap-2 rounded-pill border border-punt-ink/15 bg-punt-paper py-3 text-sm font-bold text-punt-ink transition-colors hover:bg-punt-ink/5 disabled:opacity-50"
          >
            <IconShield size={14} variant="Linear" color="#0A0A0A" />
            {busy === "settle" ? "Proving legs via TxLINE…" : "Settle (matches ended)"}
          </button>
        ) : canClaim ? (
          <button
            type="button"
            onClick={claim}
            disabled={busy === "claim"}
            className="w-full rounded-pill bg-punt-lime py-3.5 text-base font-extrabold text-punt-ink transition-transform hover:-translate-y-0.5 disabled:opacity-50"
          >
            {busy === "claim" ? "Claiming…" : `Claim $${formatUsdc(payout)}`}
          </button>
        ) : claimed ? (
          <div className="rounded-2xl bg-punt-cream/60 py-3 text-center text-sm font-bold text-punt-ink/60">
            Winnings claimed ✓
          </div>
        ) : won ? (
          <div className="rounded-2xl bg-punt-cream/60 py-3 text-center text-sm font-medium text-punt-ink/60">
            This ticket won — the owner can claim it.
          </div>
        ) : (
          <div className="rounded-2xl bg-rose-50 py-3 text-center text-sm font-bold text-rose-600">
            A pick missed — this ticket didn&apos;t hit.
          </div>
        )}
        <div className="mt-3 flex items-center gap-2 text-[11px] font-medium leading-relaxed text-punt-ink/45">
          <IconShield size={12} variant="Linear" color="#0A0A0A" />
          Each pick is proven on-chain against its own TxLINE Merkle proof and
          AND-ed together — the keeper only relays proofs.
        </div>
      </div>
    </div>
  );
}

function LegStatus({ state }: { state: "won" | "lost" | "proven" | "pending" }) {
  const map = {
    won: { label: "Hit ✓", cls: "bg-punt-lime text-punt-ink" },
    lost: { label: "Miss", cls: "bg-rose-100 text-rose-600" },
    proven: { label: "Proven", cls: "bg-emerald-100 text-emerald-700" },
    pending: { label: "Pending", cls: "bg-punt-ink/8 text-punt-ink/55" },
  }[state];
  return (
    <span
      className={`shrink-0 rounded-pill px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider ${map.cls}`}
    >
      {map.label}
    </span>
  );
}

function Flag({ name }: { name: string }) {
  const flag = teamFlagUrl(name);
  if (!flag) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={flag} alt="" className="h-4 w-4 rounded-full object-cover" />
  );
}
