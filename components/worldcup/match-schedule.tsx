"use client";

import Link from "next/link";

/**
 * Match schedule — laid out as a vertical stack of rows like the
 * host-city sites do: light pastel-blue rows for group-stage fixtures,
 * a full cup-blue row when a knockout stage starts, a deep navy row
 * for the Final. Each row links to the corresponding market on
 * /markets, not to ticketing.
 */

interface Row {
  id: string;
  date: string;
  time: string;
  matchup: string;
  tone: "soft" | "blue" | "navy";
  cta: string;
  href: string;
}

const ROWS: Row[] = [
  {
    id: "opener",
    date: "June 11, 2026",
    time: "8:00 PM ET",
    matchup: "Opening Match — Mexico v. USA",
    tone: "soft",
    cta: "Predict",
    href: "/markets",
  },
  {
    id: "fr-br",
    date: "June 14, 2026",
    time: "7:00 PM ET",
    matchup: "France v. Brazil",
    tone: "soft",
    cta: "Predict",
    href: "/markets?search=France",
  },
  {
    id: "ar-pt",
    date: "June 16, 2026",
    time: "10:00 PM ET",
    matchup: "Argentina v. Portugal",
    tone: "soft",
    cta: "Predict",
    href: "/markets?search=Argentina",
  },
  {
    id: "es-de",
    date: "June 22, 2026",
    time: "8:00 PM ET",
    matchup: "Spain v. Germany",
    tone: "soft",
    cta: "Predict",
    href: "/markets?search=Spain",
  },
  {
    id: "r32",
    date: "June 30, 2026",
    time: "5:00 PM ET",
    matchup: "Round of 32",
    tone: "blue",
    cta: "All R32 markets",
    href: "/markets",
  },
  {
    id: "r16",
    date: "July 5, 2026",
    time: "4:00 PM ET",
    matchup: "Round of 16",
    tone: "blue",
    cta: "All R16 markets",
    href: "/markets",
  },
  {
    id: "final",
    date: "July 19, 2026",
    time: "3:00 PM ET",
    matchup: "The Final",
    tone: "navy",
    cta: "Predict the final",
    href: "/markets?search=final",
  },
];

export function MatchSchedule() {
  return (
    <section className="py-4">
      <div className="text-center">
        <span className="inline-flex items-center gap-2 rounded-pill bg-cup-blue px-4 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.25em] text-punt-paper">
          Schedule
        </span>
        <h2
          className="mx-auto mt-5 font-black uppercase tracking-tight text-punt-ink"
          style={{
            fontSize: "clamp(36px, 6vw, 80px)",
            letterSpacing: "-0.03em",
            lineHeight: 0.95,
          }}
        >
          Every Match, A Market.
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm font-medium text-punt-ink/60 sm:text-base">
          From the opener to the final whistle. Each fixture below has at
          least one live market on OpenCast.
        </p>
      </div>

      <div className="mt-10 space-y-2">
        {ROWS.map((r) => (
          <ScheduleRow key={r.id} row={r} />
        ))}
      </div>
    </section>
  );
}

function ScheduleRow({ row }: { row: Row }) {
  const surface =
    row.tone === "navy"
      ? "bg-cup-navy text-punt-paper"
      : row.tone === "blue"
        ? "bg-cup-blue text-punt-paper"
        : "bg-cup-blue-soft text-punt-ink";

  const ctaSurface =
    row.tone === "soft"
      ? "bg-cup-blue text-punt-paper hover:bg-cup-navy"
      : "bg-punt-paper text-cup-navy hover:bg-punt-cream";

  return (
    <Link
      href={row.href}
      className={`group grid grid-cols-1 items-center gap-3 rounded-2xl px-5 py-4 sm:grid-cols-[1fr,1.4fr,auto] sm:gap-6 sm:px-7 sm:py-5 ${surface} transition-shadow hover:shadow-sm`}
    >
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm font-bold uppercase tracking-wider sm:text-base">
        <span>{row.date}</span>
        <span className="opacity-70">{row.time}</span>
      </div>
      <div className="text-base font-extrabold sm:text-center sm:text-lg">
        {row.matchup}
      </div>
      <span
        className={`inline-flex items-center justify-center rounded-pill px-5 py-2.5 text-xs font-extrabold uppercase tracking-wider transition-colors sm:py-3 ${ctaSurface}`}
      >
        {row.cta}
      </span>
    </Link>
  );
}
