"use client";

export type BrandLogoProps = { className?: string };

/** OpenCast wordmark — used by the giant footer block. */
export function OpenCastWordmark({ className }: BrandLogoProps) {
  return (
    <svg
      viewBox="0 0 1600 220"
      className={className}
      preserveAspectRatio="xMidYMid meet"
      aria-label="OpenCast"
    >
      <text
        x="800"
        y="180"
        textAnchor="middle"
        fontFamily="Inter Tight, ui-sans-serif, system-ui"
        fontWeight="900"
        fontSize="220"
        letterSpacing="-12"
        fill="currentColor"
      >
        OPENCAST
      </text>
    </svg>
  );
}
