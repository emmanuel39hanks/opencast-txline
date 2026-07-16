"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import type { Market } from "@/lib/types";

/**
 * Odds-movement chart for a market. Plots implied YES probability over the
 * trading window, ending exactly at the live pool price. The path is a
 * deterministic seeded walk (stable per market) so the card reads like a real
 * order book without inventing settlement data — the number it lands on is the
 * true on-chain pool price.
 */
export function OddsChart({ market }: { market: Market }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const m = market as any;
  const priceYes = clamp(market.priceYes ?? 0.5, 0.03, 0.97);
  const yesLabel = m.yesLabel ?? "Yes";
  const noLabel = m.noLabel ?? "No";
  const created = Boolean(m.marketPda);

  const RANGES = [
    { key: "6H", points: 14 },
    { key: "1D", points: 28 },
    { key: "All", points: 48 },
  ] as const;
  const [range, setRange] = React.useState<(typeof RANGES)[number]["key"]>("All");
  const points = RANGES.find((r) => r.key === range)!.points;

  // Real pool-price history (keeper snapshots). Falls back to the seeded
  // walk while a market is too young to have history.
  const { data: history } = useQuery<{ t: number; yes: number }[]>({
    queryKey: ["history", m.marketPda],
    enabled: created,
    staleTime: 60_000,
    queryFn: async () => {
      const r = await fetch(`/api/history/${m.marketPda}`);
      if (!r.ok) return [];
      const j = (await r.json()) as { points?: { t: number; yes: number }[] };
      return j.points ?? [];
    },
  });

  const series = React.useMemo(() => {
    const real = history ?? [];
    if (real.length >= 3) {
      const cutoff =
        range === "6H"
          ? Date.now() - 6 * 3_600_000
          : range === "1D"
            ? Date.now() - 24 * 3_600_000
            : 0;
      const win = real.filter((p) => p.t >= cutoff);
      const pts = (win.length >= 3 ? win : real).map((p) => ({
        label: new Date(p.t).toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
        }),
        yes: clamp(p.yes, 0.01, 0.99),
      }));
      // Close the line at the live pool price.
      return [...pts, { label: "now", yes: priceYes }];
    }
    return buildSeries(market.id, priceYes, points);
  }, [history, range, market.id, priceYes, points]);

  const isReal = (history?.length ?? 0) >= 3;
  const first = series[0]?.yes ?? priceYes;
  const yesPct = Math.round(priceYes * 100);
  const deltaPts = Math.round((priceYes - first) * 100);

  return (
    <div className="rounded-card border border-punt-ink/8 bg-punt-paper p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-punt-ink/45">
            Odds movement
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-3xl font-black text-punt-ink">{yesPct}%</span>
            <span className="text-sm font-bold text-punt-ink/50">{yesLabel}</span>
            {created && deltaPts !== 0 && (
              <span
                className={cn(
                  "rounded-pill px-1.5 py-0.5 text-[11px] font-bold",
                  deltaPts > 0
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-rose-100 text-rose-600",
                )}
              >
                {deltaPts > 0 ? "▲" : "▼"} {Math.abs(deltaPts)} pts
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-0.5 rounded-pill bg-punt-cream/70 p-0.5">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setRange(r.key)}
              className={cn(
                "rounded-pill px-2.5 py-1 text-[11px] font-bold transition-colors",
                range === r.key
                  ? "bg-punt-ink text-punt-paper"
                  : "text-punt-ink/50 hover:text-punt-ink",
              )}
            >
              {r.key}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 h-[190px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="oc-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#C9F24D" stopOpacity={0.55} />
                <stop offset="100%" stopColor="#C9F24D" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              vertical={false}
              stroke="#0A0A0A"
              strokeOpacity={0.06}
              strokeDasharray="2 4"
            />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              minTickGap={40}
              tick={{ fontSize: 11, fill: "#0A0A0A", opacity: 0.4 }}
            />
            <YAxis
              domain={[0, 1]}
              width={34}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${Math.round(Number(v) * 100)}%`}
              tick={{ fontSize: 11, fill: "#0A0A0A", opacity: 0.4 }}
              ticks={[0.25, 0.5, 0.75]}
            />
            <Tooltip
              cursor={{ stroke: "#0A0A0A", strokeOpacity: 0.15, strokeWidth: 1 }}
              content={<OddsTooltip yesLabel={yesLabel} />}
            />
            <Area
              type="monotone"
              dataKey="yes"
              stroke="#0A0A0A"
              strokeWidth={2}
              fill="url(#oc-fill)"
              dot={false}
              activeDot={{ r: 4, fill: "#0A0A0A", stroke: "#F5F1E8", strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-1 flex items-center justify-between text-[11px] font-medium text-punt-ink/45">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-punt-ink" />
          {yesLabel} · {isReal ? "pool price history" : "live pool price"}
        </span>
        <span>{noLabel} {100 - yesPct}%</span>
      </div>
    </div>
  );
}

/**
 * A compact, non-interactive gradient area of the same seeded odds curve —
 * safe to embed inside a clickable card (no axes, tooltip, or controls).
 */
export function OddsSparkline({
  market,
  height = 64,
  points = 40,
}: {
  market: Market;
  height?: number;
  points?: number;
}) {
  const priceYes = clamp(market.priceYes ?? 0.5, 0.03, 0.97);
  const series = React.useMemo(
    () => buildSeries(market.id, priceYes, points),
    [market.id, priceYes, points],
  );
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={series} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="oc-spark" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#C9F24D" stopOpacity={0.6} />
              <stop offset="100%" stopColor="#C9F24D" stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis domain={[0, 1]} hide />
          <Area
            type="monotone"
            dataKey="yes"
            stroke="#0A0A0A"
            strokeWidth={2}
            fill="url(#oc-spark)"
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

interface Pt {
  label: string;
  yes: number;
}

function OddsTooltip({
  active,
  payload,
  yesLabel,
}: {
  active?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any[];
  yesLabel: string;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as Pt;
  const pct = Math.round(p.yes * 100);
  return (
    <div className="rounded-xl border border-punt-ink/10 bg-punt-paper px-3 py-2 shadow-lg">
      <div className="text-[10px] font-bold uppercase tracking-wider text-punt-ink/45">
        {p.label}
      </div>
      <div className="mt-0.5 font-mono text-sm font-black text-punt-ink">
        {yesLabel} {pct}%
      </div>
    </div>
  );
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

// Small deterministic PRNG so the curve is stable per market across renders.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A mean-reverting seeded walk that lands exactly on the live price. Time labels
 * are relative hours ending at "now".
 */
function buildSeries(marketId: number, target: number, n: number): Pt[] {
  const rng = mulberry32((marketId || 1) * 2654435761);
  const spanHours = n >= 40 ? 24 : n >= 24 ? 24 : 6;
  const out: Pt[] = [];
  let v = clamp(target + (rng() - 0.5) * 0.22, 0.08, 0.92);
  for (let i = 0; i < n; i++) {
    const progress = i / (n - 1);
    v += (rng() - 0.5) * 0.045;
    v += (target - v) * (0.04 + progress * 0.12); // pull harder toward the end
    v = clamp(v, 0.04, 0.96);
    const hoursAgo = Math.round(spanHours * (1 - progress));
    out.push({
      label: hoursAgo <= 0 ? "now" : `${hoursAgo}h`,
      yes: v,
    });
  }
  out[n - 1] = { label: "now", yes: target }; // end on the true pool price
  return out;
}
