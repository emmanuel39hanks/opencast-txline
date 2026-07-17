"use client";

import * as React from "react";
import { WORLDCUP_FINAL_ISO } from "@/lib/worldcup-data";

/**
 * Full-width countdown band. NYNJ-inspired structure (oversized
 * DD : HH : MM : SS ticker on a bright blue ribbon with cropped
 * accent-shape ends) — rebuilt with our own SVG accents so no
 * licensed artwork is reused.
 *
 * Updates every second client-side. SSR renders zeros to avoid
 * hydration mismatch.
 */
export function CountdownBand() {
  const [t, setT] = React.useState(() => diff(WORLDCUP_FINAL_ISO));

  React.useEffect(() => {
    const id = setInterval(() => setT(diff(WORLDCUP_FINAL_ISO)), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="relative overflow-hidden rounded-card bg-cup-blue px-6 py-16 text-punt-paper sm:py-20">
      {/* Top + bottom decorative chevrons cut from the band edges */}
      <BandEdges />

      <div className="relative mx-auto flex max-w-5xl flex-col items-center text-center">
        <span className="text-[10px] font-extrabold uppercase tracking-[0.3em] text-punt-paper/70">
          The final kicks off in
        </span>
        <div
          className="mt-5 flex items-baseline justify-center gap-3 font-black tabular-nums sm:gap-6"
          style={{
            fontSize: "clamp(56px, 11vw, 160px)",
            letterSpacing: "-0.04em",
            lineHeight: 0.9,
          }}
        >
          <Slot value={t.days} label="Days" />
          <Sep />
          <Slot value={t.hours} label="Hours" />
          <Sep />
          <Slot value={t.minutes} label="Min" />
          <Sep />
          <Slot value={t.seconds} label="Sec" />
        </div>
        <p className="mt-8 max-w-md border-t border-punt-paper/25 pt-4 text-xs font-bold uppercase tracking-[0.25em] text-punt-paper/75">
          Until the last proof settles the trophy
        </p>
      </div>
    </section>
  );
}

function Slot({ value, label }: { value: number; label: string }) {
  return (
    <span className="inline-flex flex-col items-center">
      <span title={label}>{pad(value)}</span>
      <span className="mt-2 text-[9px] font-extrabold uppercase tracking-[0.3em] text-punt-paper/65">
        {label}
      </span>
    </span>
  );
}

function Sep() {
  return <span className="opacity-50">:</span>;
}

function BandEdges() {
  return (
    <>
      {/* Top edge — repeating notch pattern. */}
      <svg
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 h-6 w-full"
        viewBox="0 0 100 6"
        preserveAspectRatio="none"
      >
        <path
          d="M0 6 L4 0 L8 6 L12 0 L16 6 L20 0 L24 6 L28 0 L32 6 L36 0 L40 6 L44 0 L48 6 L52 0 L56 6 L60 0 L64 6 L68 0 L72 6 L76 0 L80 6 L84 0 L88 6 L92 0 L96 6 L100 0 L100 -2 L0 -2 Z"
          fill="#10164F"
        />
      </svg>
      <svg
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-0 h-6 w-full"
        viewBox="0 0 100 6"
        preserveAspectRatio="none"
        style={{ transform: "scaleY(-1)" }}
      >
        <path
          d="M0 6 L4 0 L8 6 L12 0 L16 6 L20 0 L24 6 L28 0 L32 6 L36 0 L40 6 L44 0 L48 6 L52 0 L56 6 L60 0 L64 6 L68 0 L72 6 L76 0 L80 6 L84 0 L88 6 L92 0 L96 6 L100 0 L100 -2 L0 -2 Z"
          fill="#10164F"
        />
      </svg>
    </>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function diff(iso: string) {
  const target = new Date(iso).getTime();
  const now = Date.now();
  const ms = Math.max(0, target - now);
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1_000);
  return { days, hours, minutes, seconds };
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}
