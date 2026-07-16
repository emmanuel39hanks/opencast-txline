import type { MarketStatus } from "@/lib/types";

/**
 * Status pill in Punt language. Plain text on a soft tint, matches the
 * other small pills in the design system (category, volume, countdown).
 */
const MAP: Record<MarketStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: "Draft", tone: "muted" },
  PENDING_APPROVAL: { label: "Pending review", tone: "amber" },
  ACTIVE: { label: "Active", tone: "lime" },
  CLOSED: { label: "Closed", tone: "muted" },
  PENDING_RESOLUTION: { label: "Resolving", tone: "sky" },
  DISPUTED: { label: "Disputed", tone: "rose" },
  RESOLVED: { label: "Resolved", tone: "ink" },
  CANCELLED: { label: "Cancelled", tone: "rose" },
};

type Tone = "lime" | "amber" | "sky" | "rose" | "ink" | "muted";

const TONE_CLASS: Record<Tone, string> = {
  // Active markets pop with the brand lime + ink — high contrast on
  // both the cream page and the white card surfaces.
  lime: "bg-punt-lime text-punt-ink",
  amber: "bg-amber-500 text-white",
  sky: "bg-sky-500 text-white",
  rose: "bg-rose-500 text-white",
  ink: "bg-punt-ink text-punt-paper",
  muted: "bg-punt-ink/5 text-punt-ink/65",
};

export function MarketStatusBadge({ status }: { status: MarketStatus }) {
  const cfg = MAP[status];
  return (
    <span
      className={`inline-flex items-center rounded-pill px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider ${TONE_CLASS[cfg.tone]}`}
    >
      {cfg.label}
    </span>
  );
}
