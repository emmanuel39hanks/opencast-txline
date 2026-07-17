"use client";

import * as React from "react";
import { use } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Check, Copy, ExternalLink, RefreshCw } from "lucide-react";
import { IconShield } from "@/lib/icons";
import { Skeleton } from "@/components/ui/skeleton";
import { teamFlagUrl } from "@/lib/teams";
import { receiptEquation } from "@/lib/hooks/useReceipt";
import { cn } from "@/lib/utils";

const TXORACLE = "6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J";
const SETTLEMENT = process.env.NEXT_PUBLIC_SETTLEMENT_PROGRAM_ID ?? "";

interface VerifyResponse {
  available: boolean;
  reason?: string;
  error?: string;
  fixtureId?: number;
  seq?: number;
  final?: boolean;
  home?: string | null;
  away?: string | null;
  question?: string | null;
  yesLabel?: string | null;
  noLabel?: string | null;
  marketPda?: string | null;
  marketStatus?: string | null;
  marketOutcome?: string | null;
  settleTxSig?: string | null;
  dailyRootPda?: string | null;
  score?: { home: number; away: number; final: boolean } | null;
  marketsOnFixture?: number;
  predicate?: string;
  predicateParts?: {
    statKeyA: number;
    statKeyB: number;
    threshold: number;
    comparison: number;
  };
  statKeys?: number[];
  namedStats?: { key: number; label: string; value: number }[];
  impliedOutcome?: "Yes" | "No" | null;
  proofMetrics?: {
    updateCount: number | null;
    firstUpdate: number | null;
    lastUpdate: number | null;
    statHashes: number;
    subTreeHashes: number;
    mainTreeHashes: number;
    totalHashes: number;
  };
  playerFacts?: { goals: string[]; yellows: string[]; reds: string[] } | null;
  independentCheck?: "recomputed-ok" | "mismatch" | "unavailable";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  proof?: any;
}

interface MatchResponse {
  available: boolean;
  match?: {
    home: string;
    away: string;
    final: boolean;
    minute: number | null;
    goals: [number, number];
    stats: { label: string; home: number; away: number }[];
    timeline: {
      seq: number;
      minute: number | null;
      kind: string;
      label: string;
      side: 1 | 2 | null;
    }[];
  };
}

export default function VerifyPage({
  params,
}: {
  params: Promise<{ fixtureId: string }>;
}) {
  const { fixtureId } = use(params);
  return (
    <React.Suspense fallback={<PageSkeleton />}>
      <VerifyInner fixtureId={fixtureId} />
    </React.Suspense>
  );
}

function PageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 px-4 py-6 sm:px-6 sm:py-10">
      <Skeleton className="h-56 w-full rounded-card" />
      <Skeleton className="h-40 w-full rounded-card" />
    </div>
  );
}

function VerifyInner({ fixtureId }: { fixtureId: string }) {
  const search = useSearchParams();
  const marketParam = search.get("m");
  const [data, setData] = React.useState<VerifyResponse | null>(null);
  const [match, setMatch] = React.useState<MatchResponse["match"] | null>(null);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const qs = marketParam ? `?m=${marketParam}` : "";
      const [v, m] = await Promise.all([
        fetch(`/api/verify/${fixtureId}${qs}`).then((r) => r.json()),
        fetch(`/api/match/${fixtureId}`)
          .then((r) => r.json())
          .catch(() => null),
      ]);
      setData(v);
      setMatch((m as MatchResponse | null)?.match ?? null);
    } catch (e) {
      setData({ available: false, error: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, [fixtureId, marketParam]);

  React.useEffect(() => {
    load();
  }, [load]);

  const copy = (v: string) => {
    navigator.clipboard.writeText(v);
    toast.success("Copied");
  };

  const backHref = `/markets/${data?.marketPda ?? fixtureId}`;
  const eventRoot = hashToHex(data?.proof?.eventStatRoot);
  const subRoot = hashToHex(data?.proof?.summary?.eventStatsSubTreeRoot);
  const pm = data?.proofMetrics;
  const settled = data?.marketStatus === "RESOLVED";
  const timeline = [...(match?.timeline ?? [])].sort((a, b) => a.seq - b.seq);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 px-4 py-6 sm:px-6 sm:py-10">
      <div className="flex items-center justify-between">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 rounded-pill bg-punt-paper px-3 py-1.5 text-xs font-bold text-punt-ink/65 transition-colors hover:text-punt-ink"
        >
          <ArrowLeft className="h-3 w-3" /> Back to market
        </Link>
        {!loading && (
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-1.5 rounded-pill bg-punt-paper px-3 py-1.5 text-xs font-bold text-punt-ink/65 transition-colors hover:text-punt-ink"
          >
            <RefreshCw className="h-3 w-3" /> Refresh
          </button>
        )}
      </div>

      {loading ? (
        <PageSkeleton />
      ) : !data?.available ? (
        <div className="rounded-card border border-punt-ink/8 bg-punt-paper p-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-punt-cream">
            <IconShield size={22} variant="Linear" color="#0A0A0A" />
          </div>
          <p className="mt-4 text-base font-black text-punt-ink">
            No proof published yet
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm font-medium leading-relaxed text-punt-ink/55">
            {data?.reason ?? data?.error ?? "TxLINE hasn't anchored a stat for this fixture."}
          </p>
          <button
            type="button"
            onClick={load}
            className="mt-5 rounded-pill border border-punt-ink/15 bg-punt-paper px-5 py-2.5 text-sm font-bold text-punt-ink hover:bg-punt-ink/5"
          >
            Refresh
          </button>
        </div>
      ) : (
        <>
          {/* ── Receipt hero: status + match scoreboard ─────────────── */}
          <div className="overflow-hidden rounded-card border border-punt-ink/8 bg-punt-paper">
            <div className="flex items-center justify-between gap-3 border-b border-punt-ink/[0.06] bg-punt-ink px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                <span
                  className={cn(
                    "grid h-7 w-7 place-items-center rounded-full",
                    data.final ? "bg-punt-lime" : "bg-amber-400",
                  )}
                >
                  <Check className="h-4 w-4 text-punt-ink" strokeWidth={3} />
                </span>
                <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-punt-paper">
                  {data.final
                    ? "Final · proof verified"
                    : "Live proof · match not final"}
                </span>
              </div>
              <span className="font-mono text-[11px] font-bold text-punt-paper/50">
                seq #{data.seq}
              </span>
            </div>

            {/* Scoreboard */}
            {match ? (
              <div className="px-5 py-5">
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                  <TeamSide team={match.home} align="right" won={match.goals[0] > match.goals[1]} />
                  <div className="text-center">
                    <div className="font-mono text-4xl font-black tabular-nums text-punt-ink">
                      {match.goals[0]}
                      <span className="mx-1.5 text-punt-ink/20">–</span>
                      {match.goals[1]}
                    </div>
                    <div className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-punt-ink/40">
                      {match.final ? "Full-time" : match.minute != null ? `${match.minute}'` : "In play"}
                    </div>
                  </div>
                  <TeamSide team={match.away} align="left" won={match.goals[1] > match.goals[0]} />
                </div>

                {/* Named events from the feed's player data */}
                {data.playerFacts &&
                  (data.playerFacts.goals.length > 0 ||
                    data.playerFacts.yellows.length > 0 ||
                    data.playerFacts.reds.length > 0) && (
                    <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-xs font-bold text-punt-ink/60">
                      {data.playerFacts.goals.length > 0 && (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full border border-punt-ink/20 bg-punt-lime" />
                          {data.playerFacts.goals.join(", ")}
                        </span>
                      )}
                      {data.playerFacts.yellows.length > 0 && (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-2.5 w-2 rounded-[2px] bg-amber-400" />
                          {data.playerFacts.yellows.join(", ")}
                        </span>
                      )}
                      {data.playerFacts.reds.length > 0 && (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-2.5 w-2 rounded-[2px] bg-rose-500" />
                          {data.playerFacts.reds.join(", ")}
                        </span>
                      )}
                    </div>
                  )}

                {/* Provable stat table — exactly what markets can settle on */}
                <div className="mt-5 overflow-hidden rounded-2xl border border-punt-ink/[0.06]">
                  {match.stats.map((s, i) => (
                    <div
                      key={s.label}
                      className={cn(
                        "grid grid-cols-[1fr_auto_1fr] items-center px-4 py-2 text-sm",
                        i % 2 === 0 ? "bg-punt-cream/40" : "bg-punt-paper",
                      )}
                    >
                      <span className="text-left font-mono font-extrabold tabular-nums text-punt-ink">
                        {s.home}
                      </span>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-punt-ink/45">
                        {s.label}
                      </span>
                      <span className="text-right font-mono font-extrabold tabular-nums text-punt-ink">
                        {s.away}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              data.home &&
              data.away && (
                <div className="px-5 py-5 text-center text-sm font-bold text-punt-ink">
                  {data.home} vs {data.away}
                </div>
              )
            )}
          </div>

          {/* ── What settles this market ────────────────────────────── */}
          {data.question && (
            <div className="rounded-card border border-punt-ink/8 bg-punt-paper p-5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-punt-ink/45">
                What settles this market
              </div>
              <h2 className="mt-1.5 text-lg font-black leading-snug text-punt-ink">
                {data.question}
              </h2>
              {data.predicate && (
                <p className="mt-2 break-words rounded-2xl bg-punt-cream/60 px-3.5 py-2.5 font-mono text-xs font-bold leading-relaxed text-punt-ink/75">
                  {data.predicate}
                </p>
              )}

              {/* The settlement math, with the proven values plugged in —
                  this is literally what the chain computes. */}
              {(() => {
                const eq = receiptEquation(data);
                return eq ? (
                  <div className="mt-2 overflow-x-auto rounded-2xl bg-punt-ink px-3.5 py-2.5 font-mono text-xs font-bold text-punt-lime">
                    {eq}
                    {data.impliedOutcome
                      ? `  →  ${data.impliedOutcome.toUpperCase()}`
                      : ""}
                  </div>
                ) : null;
              })()}

              {/* Proven values */}
              {(data.namedStats?.length ?? 0) > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {data.namedStats!.map((s) => (
                    <span
                      key={s.key}
                      className="inline-flex items-center gap-2 rounded-pill border border-punt-ink/10 bg-punt-paper px-3 py-1.5 text-xs font-bold text-punt-ink"
                    >
                      {s.label}
                      <span className="rounded-pill bg-punt-ink px-2 py-0.5 font-mono text-[11px] font-black text-punt-lime">
                        {s.value}
                      </span>
                    </span>
                  ))}
                </div>
              )}

              {/* Verdict */}
              {data.impliedOutcome && (
                <div
                  className={cn(
                    "mt-4 flex items-center gap-2.5 rounded-2xl px-4 py-3",
                    data.impliedOutcome === "Yes" ? "bg-punt-lime-soft" : "bg-rose-50",
                  )}
                >
                  <span
                    className={cn(
                      "rounded-pill px-2.5 py-1 text-[11px] font-black uppercase tracking-wide",
                      data.impliedOutcome === "Yes"
                        ? "bg-punt-lime text-punt-ink"
                        : "bg-rose-500 text-white",
                    )}
                  >
                    {data.impliedOutcome === "Yes"
                      ? (data.yesLabel ?? "Yes")
                      : (data.noLabel ?? "No")}
                  </span>
                  <span className="text-sm font-bold text-punt-ink">
                    {data.final
                      ? settled
                        ? "won — settled on-chain against this exact proof."
                        : "wins by this proof — settlement will confirm it on-chain."
                      : "leads on the current proof — not final until the whistle."}
                  </span>
                </div>
              )}

              {/* Transparency: a handful of early markets settled against a
                  provisional (pre-final) record before the final-whistle
                  selection + independent Merkle gate existed. The proof shown
                  here is the true full-time state, so the contradiction is
                  visible — we'd rather show it than hide it. */}
              {settled &&
                data.impliedOutcome &&
                data.marketOutcome &&
                data.impliedOutcome.toUpperCase() !==
                  data.marketOutcome.toUpperCase() && (
                  <div className="mt-3 rounded-2xl bg-amber-50 px-4 py-3 text-xs font-medium leading-relaxed text-amber-800">
                    <span className="font-bold">
                      This market settled early, against a provisional record.
                    </span>{" "}
                    It was resolved before our keeper required proofs from
                    at/after the final whistle (TxLINE snapshots arrive
                    unordered — a lesson now baked into the settlement gate).
                    The full-time proof above shows the true final state; the
                    on-chain outcome is immutable, so we show both rather than
                    rewrite history.
                  </div>
                )}

              {(data.marketsOnFixture ?? 0) > 1 && (
                <p className="mt-3 text-[11px] font-medium text-punt-ink/45">
                  {data.marketsOnFixture} markets settle against this fixture&apos;s
                  proof — each proves its own stat.
                </p>
              )}
            </div>
          )}

          {/* ── The proof, step by step ─────────────────────────────── */}
          <div className="rounded-card border border-punt-ink/8 bg-punt-paper p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-punt-ink/45">
                The proof, step by step
              </span>
              <span className="flex items-center gap-1.5">
                {data.independentCheck === "recomputed-ok" && (
                  <span
                    className="rounded-pill bg-punt-lime px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-punt-ink"
                    title="We re-derived the daily sub-tree root from the event-stat root and the proof's own path (plain sha256 pair-hashing) — independently of TxLINE and of the chain."
                  >
                    Recomputed independently ✓
                  </span>
                )}
                {data.independentCheck === "mismatch" && (
                  <span className="rounded-pill bg-rose-500 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-white">
                    Recomputation failed
                  </span>
                )}
                {pm && (
                  <span className="rounded-pill bg-punt-ink px-2.5 py-1 font-mono text-[10px] font-black text-punt-lime">
                    {pm.totalHashes} hashes → on-chain root
                  </span>
                )}
              </span>
            </div>

            <ol className="mt-4">
              <ChainStep
                n={1}
                title="TxLINE records the match"
                value={
                  pm?.updateCount
                    ? `${pm.updateCount} feed updates`
                    : "Official scores feed"
                }
                sub={
                  pm?.firstUpdate && pm?.lastUpdate
                    ? `${fmtTime(pm.firstUpdate)} → ${fmtTime(pm.lastUpdate)} · every update sequenced`
                    : undefined
                }
              />
              <ChainStep
                n={2}
                title="The stat leaves"
                value={
                  data.namedStats?.map((s) => `${s.label} = ${s.value}`).join(" · ") ??
                  `stat keys ${data.statKeys?.join(", ")}`
                }
                sub={`Hashed into the Merkle tree at sequence #${data.seq}`}
              />
              <ChainStep
                n={3}
                title="Leaves → event root"
                value={eventRoot ? shorten(eventRoot) : "—"}
                sub={pm ? `${pm.statHashes} sibling hashes` : undefined}
                mono
                copy={eventRoot ? () => copy(eventRoot) : undefined}
              />
              <ChainStep
                n={4}
                title="Event → daily sub-tree root"
                value={subRoot ? shorten(subRoot) : "—"}
                sub={pm ? `${pm.subTreeHashes} sibling hashes` : undefined}
                mono
                copy={subRoot ? () => copy(subRoot) : undefined}
              />
              <ChainStep
                n={5}
                title="Root anchored on Solana"
                value={
                  data.dailyRootPda
                    ? shorten(data.dailyRootPda)
                    : "txoracle · validate_stat_v2"
                }
                mono={Boolean(data.dailyRootPda)}
                copy={
                  data.dailyRootPda
                    ? () => copy(data.dailyRootPda!)
                    : undefined
                }
                sub={
                  pm
                    ? `${pm.mainTreeHashes} final ${pm.mainTreeHashes === 1 ? "hash" : "hashes"} into the day's root account — the chain recomputes it via validate_stat_v2; settlement can only pay what it confirms`
                    : undefined
                }
                href={`https://explorer.solana.com/address/${data.dailyRootPda ?? TXORACLE}?cluster=devnet`}
                last
              />
            </ol>

            {/* The settlement transaction itself — the moment the proof paid. */}
            {settled && data.settleTxSig && (
              <a
                href={`https://explorer.solana.com/tx/${data.settleTxSig}?cluster=devnet`}
                target="_blank"
                rel="noreferrer"
                className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-punt-ink px-4 py-3 transition-transform hover:-translate-y-0.5"
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-punt-lime">
                    <Check className="h-3.5 w-3.5 text-punt-ink" strokeWidth={3} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs font-extrabold text-punt-paper">
                      Settlement transaction
                    </span>
                    <span className="block truncate font-mono text-[10px] font-medium text-punt-paper/50">
                      {data.settleTxSig}
                    </span>
                  </span>
                </span>
                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-punt-paper/50" />
              </a>
            )}
          </div>

          {/* ── Match timeline (recorded events) ────────────────────── */}
          {timeline.length > 0 && match && (
            <div className="rounded-card border border-punt-ink/8 bg-punt-paper p-5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-punt-ink/45">
                As recorded by the feed
              </div>
              <div className="mt-3 space-y-1">
                {timeline.map((ev) => (
                  <div
                    key={ev.seq}
                    className="flex items-center gap-3 rounded-xl px-2 py-1.5 text-sm hover:bg-punt-cream/40"
                  >
                    <span className="w-9 shrink-0 text-right font-mono text-xs font-bold tabular-nums text-punt-ink/40">
                      {ev.minute != null ? `${ev.minute}'` : "—"}
                    </span>
                    <EventDot kind={ev.kind} />
                    <span
                      className={cn(
                        "font-bold",
                        ev.kind === "goal" ? "text-punt-ink" : "text-punt-ink/70",
                      )}
                    >
                      {ev.label}
                    </span>
                    {ev.side && (
                      <span className="ml-auto text-xs font-bold text-punt-ink/45">
                        {ev.side === 1 ? match.home : match.away}
                      </span>
                    )}
                    <span className="ml-2 font-mono text-[10px] font-medium text-punt-ink/25">
                      #{ev.seq}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── References + raw ────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3">
            <RefCard label="TxLINE oracle" addr={TXORACLE} />
            <RefCard label="Settlement program" addr={SETTLEMENT} />
          </div>

          {/* Don't trust us — recompute it. */}
          <div className="rounded-card border border-punt-ink/8 bg-punt-paper p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-punt-ink/45">
                Don&apos;t trust us — check it yourself
              </span>
              <button
                type="button"
                onClick={() => downloadProof(data)}
                className="rounded-pill border border-punt-ink/15 bg-punt-paper px-3.5 py-1.5 text-xs font-bold text-punt-ink transition-colors hover:bg-punt-ink/5"
              >
                Download proof JSON
              </button>
            </div>
            <p className="mt-2.5 text-xs font-medium leading-relaxed text-punt-ink/60">
              The whole scheme is plain sha256 pair-hashing — no special
              tooling. Download the proof and re-derive the sub-tree root in
              ~10 lines; if a single byte of the score were different, the
              hashes wouldn&apos;t reconcile:
            </p>
            <pre className="mt-3 overflow-x-auto rounded-xl bg-punt-ink p-4 text-[11px] leading-relaxed text-punt-paper/90">{`const { createHash } = require("crypto");
const p = require("./proof.json");
let h = Buffer.from(p.eventStatRoot);
for (const n of p.subTreeProof) {
  const s = Buffer.from(n.hash);
  h = createHash("sha256")
    .update(n.isRightSibling ? Buffer.concat([h, s]) : Buffer.concat([s, h]))
    .digest();
}
console.log(
  h.equals(Buffer.from(p.summary.eventStatsSubTreeRoot))
    ? "proof reconciles ✓" : "MISMATCH");`}</pre>
          </div>

          <details className="rounded-card border border-punt-ink/8 bg-punt-paper p-5">
            <summary className="cursor-pointer text-xs font-bold uppercase tracking-wider text-punt-ink/55">
              Raw proof JSON
            </summary>
            <pre className="mt-3 max-h-80 overflow-auto rounded-xl bg-punt-ink p-4 text-[11px] leading-relaxed text-punt-paper/90">
              {JSON.stringify(data.proof, null, 2)}
            </pre>
          </details>
        </>
      )}
    </div>
  );
}

// ─── Pieces ────────────────────────────────────────────────────────────────

function TeamSide({
  team,
  won,
  align,
}: {
  team: string;
  won: boolean;
  align: "left" | "right";
}) {
  const flag = teamFlagUrl(team);
  return (
    <div
      className={`flex items-center gap-2.5 ${
        align === "right" ? "flex-row-reverse text-right" : "text-left"
      }`}
    >
      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border ${
          won ? "border-punt-lime ring-2 ring-punt-lime/40" : "border-punt-ink/10"
        } bg-punt-cream`}
      >
        {flag ? (
          <Image
            src={flag}
            alt={team}
            width={44}
            height={44}
            className="h-full w-full object-cover"
            unoptimized
          />
        ) : (
          <span className="text-sm font-black text-punt-ink/40">
            {team.slice(0, 2).toUpperCase()}
          </span>
        )}
      </div>
      <div className="min-w-0">
        <div className="truncate text-sm font-bold text-punt-ink">{team}</div>
        {won && (
          <div className="text-[10px] font-bold uppercase tracking-wider text-punt-ink/45">
            Winner
          </div>
        )}
      </div>
    </div>
  );
}

/** Small colored marker per event type — Punt-style, no emoji. */
function EventDot({ kind }: { kind: string }) {
  const cls =
    kind === "goal" || kind === "penalty"
      ? "bg-punt-lime border-punt-ink/20"
      : kind === "yellow"
        ? "bg-amber-400 border-amber-500/30 rounded-[3px]"
        : kind === "red"
          ? "bg-rose-500 border-rose-600/30 rounded-[3px]"
          : kind === "fulltime" || kind === "halftime" || kind === "kickoff"
            ? "bg-punt-ink border-punt-ink"
            : "bg-punt-ink/15 border-punt-ink/10";
  return <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full border", cls)} />;
}

function ChainStep({
  n,
  title,
  value,
  sub,
  mono,
  copy,
  href,
  last,
}: {
  n: number;
  title: string;
  value: string;
  sub?: string;
  mono?: boolean;
  copy?: () => void;
  href?: string;
  last?: boolean;
}) {
  return (
    <li className="relative flex gap-4 pb-5 last:pb-0">
      {!last && (
        <span className="absolute left-[15px] top-8 h-full w-px bg-punt-ink/10" />
      )}
      <span className="z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-punt-ink text-xs font-black text-punt-paper">
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-bold uppercase tracking-wider text-punt-ink/45">
          {title}
        </div>
        <div className="mt-0.5 flex items-center gap-2">
          {href ? (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-bold text-punt-ink hover:underline"
            >
              {value}
              <ExternalLink className="h-3 w-3 text-punt-ink/40" />
            </a>
          ) : (
            <span
              className={`text-sm font-bold leading-snug text-punt-ink ${mono ? "font-mono" : ""}`}
            >
              {value}
            </span>
          )}
          {copy && (
            <button onClick={copy} aria-label="Copy">
              <Copy className="h-3 w-3 text-punt-ink/40 hover:text-punt-ink" />
            </button>
          )}
        </div>
        {sub && (
          <div className="mt-0.5 text-xs font-medium text-punt-ink/45">{sub}</div>
        )}
      </div>
    </li>
  );
}

function RefCard({ label, addr }: { label: string; addr: string }) {
  return (
    <a
      href={`https://explorer.solana.com/address/${addr}?cluster=devnet`}
      target="_blank"
      rel="noreferrer"
      className="group rounded-card border border-punt-ink/8 bg-punt-paper p-4 transition-colors hover:border-punt-ink/20"
    >
      <div className="text-[10px] font-bold uppercase tracking-wider text-punt-ink/40">
        {label}
      </div>
      <div className="mt-1 flex items-center gap-1.5 font-mono text-xs font-bold text-punt-ink">
        {addr ? `${addr.slice(0, 6)}…${addr.slice(-6)}` : "—"}
        <ExternalLink className="h-3 w-3 text-punt-ink/40 group-hover:text-punt-ink" />
      </div>
    </a>
  );
}

/** TxLINE roots come as 32-byte number arrays; render as hex. */
function hashToHex(arr?: number[]): string | null {
  if (!Array.isArray(arr) || !arr.length) return null;
  return arr.map((b) => Number(b).toString(16).padStart(2, "0")).join("");
}

function shorten(hex: string): string {
  return hex.length > 20 ? `${hex.slice(0, 10)}…${hex.slice(-10)}` : hex;
}

function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Save the raw TxLINE proof as proof.json — pairs with the verify snippet. */
function downloadProof(data: VerifyResponse) {
  const blob = new Blob([JSON.stringify(data.proof, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `proof-${data.fixtureId ?? "fixture"}-seq${data.seq ?? 0}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
