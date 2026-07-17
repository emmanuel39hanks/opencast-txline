"use client";

import * as React from "react";
import Image from "next/image";
import {
  ArrowLeftRight,
  CircleCheck,
  Flag,
  Goal,
  MonitorPlay,
  Pause,
  Play,
  Plus,
  Target,
} from "lucide-react";
import { teamFlagUrl } from "@/lib/teams";
import { cn } from "@/lib/utils";
import type { MatchData, MatchEvent } from "@/lib/txline/match";

/**
 * Live match card powered by the TxLINE score feed: scoreboard, stat bars, and
 * an event timeline. Polls while the match is running (the free WC tier replays
 * real matches, so the clock advances).
 */
export function LiveMatchCard({
  fixtureId,
  settled = false,
}: {
  fixtureId: number;
  /** On-chain settlement is the source of truth for "match over" — the free
   *  replay feed keeps streaming a live clock, so we override it when settled. */
  settled?: boolean;
}) {
  const [data, setData] = React.useState<MatchData | null>(null);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    try {
      const r = await fetch(`/api/match/${fixtureId}`);
      const j = await r.json();
      if (j.available) setData(j.match as MatchData);
      else setData(null);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [fixtureId]);

  React.useEffect(() => {
    load();
    if (settled) return; // final result won't change — no need to listen

    // Primary: TxLINE's SSE score stream (proxied server-side) — every event
    // for this fixture triggers an immediate refresh. Fallback: slow polling,
    // in case the stream can't connect (EventSource auto-reconnects).
    let es: EventSource | null = null;
    let sseLive = false;
    try {
      es = new EventSource(`/api/stream/${fixtureId}`);
      es.onopen = () => {
        sseLive = true;
      };
      es.onmessage = () => load();
      es.onerror = () => {
        sseLive = false;
      };
    } catch {
      es = null;
    }
    const id = setInterval(() => {
      if (!sseLive) load();
    }, 15_000);
    return () => {
      es?.close();
      clearInterval(id);
    };
  }, [load, settled, fixtureId]);

  if (loading) {
    return (
      <div className="h-64 w-full animate-pulse rounded-card border border-punt-ink/8 bg-punt-ink/[0.03]" />
    );
  }
  if (!data) return null;

  const ended = settled || data.final;
  const statusLabel = ended
    ? "Full-time"
    : data.running && data.minute != null
      ? `${data.minute}'`
      : data.gameState.replace(/_/g, " ");

  return (
    <div className="overflow-hidden rounded-card border border-punt-ink/8 bg-punt-paper">
      {/* Scoreboard */}
      <div className="bg-punt-ink px-6 py-6 text-punt-paper">
        <div className="mb-3 flex items-center justify-center gap-2">
          {!ended && data.running && (
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-punt-lime" />
          )}
          <span className="text-[11px] font-bold uppercase tracking-wider text-punt-paper/60">
            {statusLabel}
          </span>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
          <ScoreTeam name={data.home} align="right" />
          <div className="flex items-center gap-3 font-mono text-4xl font-black tabular-nums">
            <span>{data.goals[0]}</span>
            <span className="text-punt-paper/30">–</span>
            <span>{data.goals[1]}</span>
          </div>
          <ScoreTeam name={data.away} align="left" />
        </div>
      </div>

      {/* Stat bars */}
      <div className="space-y-3 px-6 py-5">
        <div className="text-[10px] font-bold uppercase tracking-wider text-punt-ink/40">
          Match stats · live from TxLINE
        </div>
        {data.stats.map((s) => (
          <StatBar key={s.label} label={s.label} home={s.home} away={s.away} />
        ))}
      </div>

      {/* Timeline */}
      {data.timeline.length > 0 && (
        <div className="border-t border-punt-ink/8 px-4 py-5 sm:px-6">
          <div className="mb-3 flex items-baseline justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-punt-ink/40">
              Timeline
            </span>
            <span className="text-[10px] font-medium text-punt-ink/35">
              latest first · as recorded by TxLINE
            </span>
          </div>
          <ol className="relative space-y-1">
            {/* Rail through the event badges */}
            <span
              aria-hidden
              className="absolute bottom-3 left-[59px] top-3 w-px bg-punt-ink/8"
            />
            {data.timeline
              .slice()
              .reverse()
              .slice(0, 14)
              .map((e, i) => {
                const team = e.side ? (e.side === 1 ? data.home : data.away) : null;
                const big = e.kind === "goal" || e.kind === "penalty" || e.kind === "red";
                return (
                  <li
                    key={`${e.seq}-${i}`}
                    className={cn(
                      "relative flex items-center gap-3 rounded-xl px-1 py-1.5 text-sm",
                      big && "bg-punt-lime-soft/50",
                    )}
                  >
                    <span className="w-9 shrink-0 text-right font-mono text-xs font-bold tabular-nums text-punt-ink/45">
                      {e.minute != null ? `${e.minute}'` : ""}
                    </span>
                    <EventBadge kind={e.kind} />
                    <span
                      className={cn(
                        "min-w-0 truncate",
                        big ? "font-extrabold text-punt-ink" : "font-semibold text-punt-ink/80",
                      )}
                    >
                      {e.label}
                    </span>
                    {team && (
                      <span className="ml-auto flex shrink-0 items-center gap-1.5 text-xs font-bold text-punt-ink/55">
                        <span className="hidden max-w-[7rem] truncate sm:block">{team}</span>
                        <TeamDot name={team} />
                      </span>
                    )}
                  </li>
                );
              })}
          </ol>
        </div>
      )}
    </div>
  );
}

/** Icon badge per event type — consistent iconography, no emoji. */
function EventBadge({ kind }: { kind: MatchEvent["kind"] }) {
  // Yellow/red cards read best as actual cards, not glyphs.
  if (kind === "yellow" || kind === "red") {
    return (
      <span className="grid h-6 w-6 shrink-0 place-items-center">
        <span
          className={cn(
            "h-3.5 w-2.5 rounded-[3px] shadow-sm",
            kind === "yellow" ? "bg-amber-400" : "bg-rose-500",
          )}
        />
      </span>
    );
  }
  const spec: Record<
    Exclude<MatchEvent["kind"], "yellow" | "red">,
    { Icon: React.ElementType; cls: string }
  > = {
    goal: { Icon: Goal, cls: "bg-punt-lime text-punt-ink" },
    penalty: { Icon: Target, cls: "bg-punt-lime text-punt-ink" },
    sub: { Icon: ArrowLeftRight, cls: "bg-punt-ink/[0.06] text-punt-ink/60" },
    var: { Icon: MonitorPlay, cls: "bg-punt-ink/[0.06] text-punt-ink/60" },
    corner: { Icon: Flag, cls: "bg-punt-ink/[0.06] text-punt-ink/60" },
    kickoff: { Icon: Play, cls: "bg-punt-ink text-punt-paper" },
    halftime: { Icon: Pause, cls: "bg-punt-ink text-punt-paper" },
    fulltime: { Icon: CircleCheck, cls: "bg-punt-ink text-punt-paper" },
    injury: { Icon: Plus, cls: "bg-punt-ink/[0.06] text-punt-ink/60" },
  };
  const { Icon, cls } = spec[kind as Exclude<MatchEvent["kind"], "yellow" | "red">];
  return (
    <span
      className={cn(
        "grid h-6 w-6 shrink-0 place-items-center rounded-full",
        cls,
      )}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={2.5} />
    </span>
  );
}

/** Tiny team flag for timeline rows; falls back to nothing when unknown. */
function TeamDot({ name }: { name: string }) {
  const flag = teamFlagUrl(name);
  if (!flag) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={flag}
      alt={name}
      className="h-4 w-4 rounded-full border border-punt-ink/10 object-cover"
      loading="lazy"
    />
  );
}

function ScoreTeam({ name, align }: { name: string; align: "left" | "right" }) {
  const flag = teamFlagUrl(name);
  return (
    <div
      className={`flex min-w-0 items-center gap-2.5 ${
        align === "right" ? "flex-row-reverse text-right" : "text-left"
      }`}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-punt-paper/10">
        {flag ? (
          <Image src={flag} alt={name} width={36} height={36} className="h-full w-full object-cover" unoptimized />
        ) : (
          <span className="text-xs font-black">{name.slice(0, 2).toUpperCase()}</span>
        )}
      </div>
      <span className="min-w-0 truncate text-sm font-bold">{name}</span>
    </div>
  );
}

function StatBar({ label, home, away }: { label: string; home: number; away: number }) {
  const total = home + away;
  const homePct = total > 0 ? (home / total) * 100 : 50;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs font-bold text-punt-ink">
        <span className="tabular-nums">{home}</span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-punt-ink/45">
          {label}
        </span>
        <span className="tabular-nums">{away}</span>
      </div>
      <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-full">
        <div className="rounded-l-full bg-punt-ink/70" style={{ width: `${homePct}%` }} />
        <div className="flex-1 rounded-r-full bg-punt-ink/15" />
      </div>
    </div>
  );
}
