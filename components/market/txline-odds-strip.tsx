"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { TeamCircle } from "@/components/market/market-card";

interface OddsLine {
  available: boolean;
  bookmaker?: string;
  ts?: number;
  inRunning?: boolean;
  home?: string;
  away?: string;
  line?: { home: number | null; draw: number | null; away: number | null };
}

/**
 * TxLINE's own match line, shown next to the pool odds — the second TxODDS
 * feed we consume. Renders nothing when the feed has no odds for the fixture.
 */
export function TxLineOddsStrip({ fixtureId }: { fixtureId: number }) {
  const { data } = useQuery<OddsLine>({
    queryKey: ["txline-odds", fixtureId],
    staleTime: 30_000,
    refetchInterval: 60_000,
    queryFn: async () => {
      const r = await fetch(`/api/odds/${fixtureId}`);
      if (!r.ok) return { available: false };
      return (await r.json()) as OddsLine;
    },
  });

  if (!data?.available || !data.line) return null;
  const { line } = data;
  const cell = (label: string, v: number | null, team?: string) => (
    <span className="flex items-center gap-1.5">
      {team && <TeamCircle name={team} size={16} />}
      <span className="font-bold text-punt-ink/70">{label}</span>
      <span className="font-mono font-extrabold text-punt-ink">
        {v != null ? `${Math.round(v)}%` : "—"}
      </span>
    </span>
  );

  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-2xl bg-punt-cream/60 px-3.5 py-2.5 text-xs">
      <span className="rounded-pill bg-punt-ink px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-punt-lime">
        TxLINE line
      </span>
      {cell(data.home ?? "Home", line.home, data.home)}
      {cell("Draw", line.draw)}
      {cell(data.away ?? "Away", line.away, data.away)}
      <span className="ml-auto text-[10px] font-medium text-punt-ink/40">
        {data.inRunning ? "in-running · " : ""}TxODDS feed ·{" "}
        {data.ts
          ? new Date(data.ts).toLocaleTimeString(undefined, {
              hour: "2-digit",
              minute: "2-digit",
            })
          : ""}
      </span>
    </div>
  );
}
