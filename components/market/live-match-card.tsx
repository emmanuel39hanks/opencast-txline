"use client";

import * as React from "react";
import Image from "next/image";
import { teamFlagUrl } from "@/lib/teams";
import type { MatchData, MatchEvent } from "@/lib/txline/match";

const KIND_ICON: Record<MatchEvent["kind"], string> = {
  goal: "⚽",
  penalty: "🎯",
  yellow: "🟨",
  red: "🟥",
  sub: "🔁",
  var: "📺",
  corner: "🚩",
  kickoff: "▶️",
  halftime: "⏸️",
  fulltime: "🏁",
  injury: "➕",
};

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
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
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
        <div className="border-t border-punt-ink/8 px-6 py-5">
          <div className="mb-3 text-[10px] font-bold uppercase tracking-wider text-punt-ink/40">
            Timeline
          </div>
          <ol className="space-y-2">
            {data.timeline
              .slice()
              .reverse()
              .slice(0, 14)
              .map((e, i) => (
                <li key={`${e.seq}-${i}`} className="flex items-center gap-3 text-sm">
                  <span className="w-9 shrink-0 text-right font-mono text-xs font-bold text-punt-ink/45">
                    {e.minute != null ? `${e.minute}'` : "—"}
                  </span>
                  <span className="text-base leading-none">{KIND_ICON[e.kind]}</span>
                  <span className="font-semibold text-punt-ink">{e.label}</span>
                  {e.side && (
                    <span className="ml-auto max-w-[8rem] truncate text-xs font-bold text-punt-ink/50">
                      {e.side === 1 ? data.home : data.away}
                    </span>
                  )}
                </li>
              ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function ScoreTeam({ name, align }: { name: string; align: "left" | "right" }) {
  const flag = teamFlagUrl(name);
  return (
    <div
      className={`flex items-center gap-2.5 ${
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
