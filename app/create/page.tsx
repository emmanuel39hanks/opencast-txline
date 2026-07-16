"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useWallet } from "@/lib/wallet";
import { useSettlement } from "@/lib/solana/client";
import { RecommendedBetsSheet } from "@/components/create/recommended-bets-sheet";
import { BetTypeIcon } from "@/components/market/bet-type-icon";
import { teamFlagUrl } from "@/lib/teams";
import { cn, formatUsdc } from "@/lib/utils";
import {
  IconMagic,
  IconShield,
  IconArrowRight,
  IconCheck,
} from "@/lib/icons";

interface Draft {
  ok: true;
  fixtureId: number;
  question: string;
  yesLabel: string;
  noLabel: string;
  home: string;
  away: string;
  kickoff: string;
  statKeyA: number;
  statKeyB: number;
  threshold: number;
  comparison: number;
  betType: string;
  betTypeLabel: string;
  subject: string;
  resolves: string;
  reasoning: string;
  confidence: number;
  impliedProb: number;
  provenance: { provider: string; model: string; attestation: string };
}

const EXAMPLES = [
  "Will England beat Argentina?",
  "Will Spain win 6+ corners?",
  "England to score 2+ goals",
  "Argentina to keep a clean sheet",
  "Will Brazil win by 2+?",
  "France or draw vs Spain",
  "Will Messi's team get a red card?",
  "England to lead at half-time",
];

/**
 * /create — permissionless market creation. Type a question, the AI drafts
 * it into a verifiable TxLINE match-winner market, seed liquidity, and create
 * it on-chain with the Privy embedded wallet.
 */
export default function CreatePage() {
  const router = useRouter();
  const { authenticated, connect, address, usdcBalance, refreshBalance } =
    useWallet();
  const { createMarket } = useSettlement();

  const [question, setQuestion] = React.useState("");
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [seed, setSeed] = React.useState(50);
  const [busy, setBusy] = React.useState<null | "draft" | "create">(null);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  // An already-created market with the exact same predicate on this fixture.
  const [existing, setExisting] = React.useState<{
    slug: string;
    question: string;
    volume: number;
  } | null>(null);

  /** Same fixture + same on-chain predicate = the same prediction. */
  const findExisting = async (d: Draft) => {
    try {
      const r = await fetch("/api/markets");
      const j = (await r.json()) as {
        markets?: Array<{
          id: number;
          slug?: string;
          marketPda?: string | null;
          question: string;
          totalVolumeUsdc?: number;
          statKeyA?: number;
          statKeyB?: number;
          threshold?: number;
          comparison?: number;
        }>;
      };
      const dupe = (j.markets ?? []).find(
        (m) =>
          m.marketPda &&
          m.id === d.fixtureId &&
          Number(m.statKeyA) === d.statKeyA &&
          Number(m.statKeyB) === d.statKeyB &&
          Number(m.threshold) === d.threshold &&
          Number(m.comparison) === d.comparison,
      );
      return dupe
        ? {
            slug: dupe.slug ?? dupe.marketPda!,
            question: dupe.question,
            volume: dupe.totalVolumeUsdc ?? 0,
          }
        : null;
    } catch {
      return null;
    }
  };

  const [unprovable, setUnprovable] = React.useState<{
    message: string;
    suggestions: string[];
  } | null>(null);
  // Opening YES probability: TxODDS' line when the prediction maps onto it,
  // otherwise the drafting model's estimate. The seed splits at this ratio
  // so the market opens at real odds instead of 50/50.
  const [opening, setOpening] = React.useState<{
    pct: number;
    source: "TxODDS line" | "AI estimate";
  } | null>(null);

  const deriveOpening = async (d: Draft) => {
    try {
      const r = await fetch(`/api/odds/${d.fixtureId}`);
      const line = (await r.json()) as {
        available: boolean;
        home?: string;
        away?: string;
        line?: { home: number | null; draw: number | null; away: number | null };
      };
      if (line.available && line.line) {
        const side = (team: string) =>
          team === line.home ? line.line!.home : team === line.away ? line.line!.away : null;
        let pct: number | null = null;
        if (d.betType === "winner") pct = side(d.subject);
        else if (d.betType === "draw") pct = line.line.draw;
        else if (d.betType === "double_chance") {
          const opp = d.subject === line.home ? line.away : line.home;
          const oppWin = opp ? side(opp) : null;
          pct = oppWin != null ? 100 - oppWin : null;
        }
        if (pct != null) return { pct: pct / 100, source: "TxODDS line" as const };
      }
    } catch {
      /* fall through to the model's estimate */
    }
    return { pct: d.impliedProb ?? 0.5, source: "AI estimate" as const };
  };

  const onDraft = async (q?: string) => {
    const qq = (q ?? question).trim();
    if (qq.length < 3) return;
    setBusy("draft");
    setDraft(null);
    setExisting(null);
    setUnprovable(null);
    setOpening(null);
    try {
      const r = await fetch("/api/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: qq }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      if (j.unprovable) {
        setUnprovable({
          message: j.message,
          suggestions: j.suggestions ?? [],
        });
        return;
      }
      setDraft(j as Draft);
      setOpening(await deriveOpening(j as Draft));
      setExisting(await findExisting(j as Draft));
    } catch (e) {
      toast.error("Draft failed", {
        description: (e as Error).message.slice(0, 120),
      });
    } finally {
      setBusy(null);
    }
  };

  const onCreate = async () => {
    if (!draft) return;
    if (!authenticated) {
      connect();
      return;
    }
    setBusy("create");
    try {
      // Last-second dupe guard — someone may have created it since drafting.
      const dupe = await findExisting(draft);
      if (dupe) {
        setExisting(dupe);
        toast.info("This market already exists — taking you there.");
        router.push(`/markets/${dupe.slug}`);
        return;
      }
      const res = await createMarket({
        fixtureId: draft.fixtureId,
        statKeyA: draft.statKeyA,
        statKeyB: draft.statKeyB,
        threshold: draft.threshold,
        comparison: draft.comparison,
        seedAmountUsdc: seed,
        openingYesPct: opening?.pct,
      });
      await fetch("/api/markets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marketPda: res.market,
          fixtureId: draft.fixtureId,
          statKeys: [draft.statKeyA, draft.statKeyB],
          strategy: {
            statKeyA: draft.statKeyA,
            statKeyB: draft.statKeyB,
            threshold: draft.threshold,
            comparison: draft.comparison,
            betType: draft.betType,
          },
          question: draft.question,
          yesLabel: draft.yesLabel,
          noLabel: draft.noLabel,
          creator: address,
        }),
      });
      toast.success("Market created on-chain");
      setTimeout(refreshBalance, 1500);
      // Route by PDA — a fixture can host many markets, this one is yours.
      router.push(`/markets/${res.market}`);
    } catch (e) {
      toast.error("Create failed", {
        description: (e as Error).message.slice(0, 120),
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="flex items-center gap-2">
        <span className="punt-sticker -rotate-2 border-punt-ink/80 bg-punt-lime text-punt-ink">
          <IconMagic size={11} variant="Bold" color="#0A0A0A" />
          Permissionless
        </span>
      </div>
      <h1 className="mt-3 text-3xl font-black leading-tight text-punt-ink sm:text-4xl">
        Create a market
      </h1>
      <p className="mt-2 text-sm font-medium leading-relaxed text-punt-ink/60">
        Ask about any World Cup match. We draft it into a market that settles
        trustlessly on TxLINE — no admin, no approval queue. Want to stack picks
        from existing markets instead?{" "}
        <a href="/parlays/new" className="font-bold text-punt-ink underline underline-offset-2 hover:opacity-70">
          Build a parlay →
        </a>
      </p>

      {/* Question */}
      <div className="mt-7 rounded-card border border-punt-ink/8 bg-punt-paper p-5">
        <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-punt-ink/50">
          Your question
        </label>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={2}
          placeholder="Will Brazil beat Argentina?"
          className="w-full resize-none rounded-2xl border border-punt-ink/10 bg-punt-cream/40 px-4 py-3 text-base font-semibold text-punt-ink outline-none placeholder:text-punt-ink/30 focus:border-punt-ink/25"
        />
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setQuestion(ex)}
              className="rounded-pill border border-punt-ink/10 bg-punt-paper px-3 py-1 text-xs font-medium text-punt-ink/60 transition-colors hover:bg-punt-ink/5"
            >
              {ex}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="rounded-pill border border-punt-ink/15 bg-punt-lime-soft px-3 py-1 text-xs font-bold text-punt-ink transition-colors hover:bg-punt-lime"
          >
            Browse matches →
          </button>
        </div>
        <button
          type="button"
          onClick={() => onDraft()}
          disabled={busy === "draft" || question.trim().length < 3}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-pill bg-punt-ink py-3.5 text-base font-extrabold text-punt-paper transition-transform hover:-translate-y-0.5 disabled:opacity-40"
        >
          <IconMagic size={16} variant="Bold" color="#F5F1E8" />
          {busy === "draft" ? "Drafting…" : "Draft prediction"}
        </button>
      </div>

      <RecommendedBetsSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onPick={(q) => {
          setQuestion(q);
          onDraft(q);
        }}
      />

      {/* Can't be proven — guide, don't error */}
      {unprovable && (
        <div className="mt-5 rounded-card border border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-bold text-punt-ink">
            That one can&apos;t be proven from match data.
          </p>
          <p className="mt-1 text-xs font-medium leading-relaxed text-punt-ink/60">
            {unprovable.message}
          </p>
          {unprovable.suggestions.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {unprovable.suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setQuestion(s);
                    onDraft(s);
                  }}
                  className="rounded-pill border border-punt-ink/10 bg-punt-paper px-3 py-1.5 text-xs font-bold text-punt-ink/70 transition-colors hover:bg-punt-ink/5"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Draft preview */}
      {draft && (
        <div className="mt-5 rounded-card border border-punt-ink/8 bg-punt-paper p-5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-punt-ink/50">
              <IconCheck size={13} variant="Bold" color="#0A0A0A" />
              AI draft
            </span>
            <span className="rounded-pill bg-punt-lime/60 px-2.5 py-1 text-[10px] font-bold text-punt-ink">
              {Math.round(draft.confidence * 100)}% match
            </span>
          </div>

          <h2 className="mt-3 text-xl font-black text-punt-ink">{draft.question}</h2>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1.5 rounded-pill bg-punt-ink px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-punt-paper">
              <BetTypeIcon type={draft.betType} size={12} className="text-punt-lime" />
              {draft.betTypeLabel}
            </span>
            <span className="text-[11px] font-medium text-punt-ink/50">
              Single TxLINE stat proof · fully verifiable
            </span>
          </div>

          {/* Match context */}
          <div className="mt-3 flex items-center gap-2 rounded-2xl bg-punt-cream/50 px-3 py-2 text-sm font-bold text-punt-ink/75">
            <TeamFlag name={draft.home} />
            <span className="truncate">{draft.home}</span>
            <span className="text-xs font-black text-punt-ink/30">vs</span>
            <TeamFlag name={draft.away} />
            <span className="truncate">{draft.away}</span>
          </div>

          {/* YES / NO outcomes */}
          <div className="mt-2.5 grid grid-cols-2 gap-2">
            <div className="rounded-2xl border-2 border-punt-lime bg-punt-lime/85 px-3 py-3 text-center">
              <div className="text-[10px] font-bold uppercase tracking-wider text-punt-ink/55">
                Yes
              </div>
              <div className="mt-0.5 truncate text-sm font-bold text-punt-ink">
                {draft.yesLabel}
              </div>
            </div>
            <div className="rounded-2xl border-2 border-rose-200 bg-rose-50 px-3 py-3 text-center">
              <div className="text-[10px] font-bold uppercase tracking-wider text-rose-400">
                No
              </div>
              <div className="mt-0.5 truncate text-sm font-bold text-rose-600">
                {draft.noLabel}
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl bg-punt-cream/60 p-3.5 text-xs font-medium leading-relaxed text-punt-ink/70">
            <div className="mb-1 flex items-center gap-1.5 font-bold text-punt-ink">
              <IconShield size={12} variant="Linear" color="#0A0A0A" />
              How it settles
            </div>
            {draft.resolves} Verified on-chain against TxLINE&apos;s official
            stat proof — no one can override it.
          </div>

          {/* Liquidity */}
          <div className="mt-5">
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-punt-ink/50">
                Seed liquidity
              </label>
              <span className="font-mono text-sm font-extrabold text-punt-ink">
                ${seed} <span className="text-punt-ink/40">USDC</span>
              </span>
            </div>
            <input
              type="range"
              min={10}
              max={500}
              step={10}
              value={seed}
              onChange={(e) => setSeed(Number(e.target.value))}
              className="w-full accent-punt-ink"
            />
            {authenticated && (
              <div className="mt-1 text-[11px] font-medium text-punt-ink/45">
                Balance ${formatUsdc(usdcBalance)}
              </div>
            )}
            <div className="mt-3 space-y-1.5 rounded-2xl bg-punt-cream/60 p-3.5 text-[11px] font-medium leading-relaxed text-punt-ink/60">
              <p>
                <span className="font-bold text-punt-ink">
                  {opening
                    ? `Opens at ${Math.round(opening.pct * 100)}% ${draft.yesLabel}`
                    : "Your seed opens the odds at 50/50"}
                </span>
                {opening && (
                  <span className="ml-1.5 rounded-pill bg-punt-ink px-1.5 py-px text-[9px] font-extrabold uppercase tracking-wide text-punt-lime">
                    {opening.source}
                  </span>
                )}{" "}
                — your seed splits at that ratio and belongs to the pool, so
                early traders face real odds, not a blank 50/50. It pays out
                to the winning side like any other stake.
              </p>
              <p>
                <span className="font-bold text-punt-ink">The only fee</span>{" "}
                is 2%, withheld from winning payouts when they&apos;re claimed.
                No spread, no juice, nothing on the way in.
              </p>
            </div>
          </div>

          {/* Duplicate guard — same fixture + same predicate = same prediction */}
          {existing && (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-xs font-medium leading-relaxed text-amber-800">
              <span className="font-bold">This prediction is already live.</span>{" "}
              “{existing.question}” has ${formatUsdc(existing.volume)} in its
              pool — creating a duplicate would just split the liquidity.
            </div>
          )}

          {existing ? (
            <button
              type="button"
              onClick={() => router.push(`/markets/${existing.slug}`)}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-pill bg-punt-ink py-3.5 text-base font-extrabold text-punt-paper transition-transform hover:-translate-y-0.5"
            >
              Trade the existing market
              <IconArrowRight size={16} variant="Linear" color="#F5F1E8" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onCreate}
              disabled={busy === "create"}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-pill bg-punt-lime py-3.5 text-base font-extrabold text-punt-ink transition-transform hover:-translate-y-0.5 disabled:opacity-50"
            >
              {busy === "create"
                ? "Creating on-chain…"
                : authenticated
                  ? "Create market on-chain"
                  : "Connect wallet to create"}
              <IconArrowRight size={16} variant="Linear" color="#0A0A0A" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function TeamFlag({ name }: { name: string }) {
  const flag = teamFlagUrl(name);
  if (!flag) {
    return (
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-punt-ink/10 text-[9px] font-black text-punt-ink/50">
        {name.slice(0, 2).toUpperCase()}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={flag}
      alt={name}
      className="h-6 w-6 shrink-0 rounded-full border border-punt-ink/10 object-cover"
    />
  );
}
