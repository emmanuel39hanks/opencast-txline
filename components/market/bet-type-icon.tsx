import * as React from "react";

/**
 * Minimal, on-brand SVG icons for each provable bet type. Monochrome
 * (currentColor) except the yellow/red cards which carry their own tint, so
 * they read instantly in a chip. Every icon maps to a real TxLINE stat.
 */
export type BetTypeKey =
  | "winner"
  | "double_chance"
  | "spread"
  | "draw"
  | "goals_over"
  | "clean_sheet"
  | "corners_over"
  | "booking"
  | "red_card"
  | "first_half_winner"
  | "first_half_goal"
  | string;

export function BetTypeIcon({
  type,
  size = 18,
  className,
}: {
  type: BetTypeKey;
  size?: number;
  className?: string;
}) {
  const p = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    className,
    "aria-hidden": true,
  } as const;
  const S = {
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (type) {
    case "winner":
      // Trophy
      return (
        <svg {...p}>
          <path {...S} d="M7 4h10v4a5 5 0 0 1-10 0V4Z" />
          <path {...S} d="M7 5H4v1a3 3 0 0 0 3 3M17 5h3v1a3 3 0 0 1-3 3" />
          <path {...S} d="M12 13v3M9 20h6M10 20l.5-4h3l.5 4" />
        </svg>
      );
    case "goals_over":
    case "first_half_goal":
      // Ball
      return (
        <svg {...p}>
          <circle {...S} cx="12" cy="12" r="8.5" />
          <path {...S} d="m12 7 3 2.2-1.1 3.5h-3.8L9 9.2 12 7Z" />
          <path {...S} d="m9 9.2-3.4-.8M15 9.2l3.4-.8M10.1 12.7 8 15.6M13.9 12.7l2.1 2.9M12 16.2v3" />
        </svg>
      );
    case "corners_over":
      // Corner flag
      return (
        <svg {...p}>
          <path {...S} d="M6 3v18" />
          <path {...S} d="M6 4h11l-3 3 3 3H6" />
          <path {...S} d="M4 21h6" />
        </svg>
      );
    case "booking":
      // Yellow card
      return (
        <svg {...p}>
          <rect x="6" y="3.5" width="12" height="17" rx="2" fill="#F5C518" stroke="none" />
          <rect x="6" y="3.5" width="12" height="17" rx="2" stroke="#0A0A0A" strokeOpacity="0.25" strokeWidth="1" fill="none" />
        </svg>
      );
    case "red_card":
      // Red card
      return (
        <svg {...p}>
          <rect x="6" y="3.5" width="12" height="17" rx="2" fill="#E23744" stroke="none" />
          <rect x="6" y="3.5" width="12" height="17" rx="2" stroke="#0A0A0A" strokeOpacity="0.2" strokeWidth="1" fill="none" />
        </svg>
      );
    case "clean_sheet":
      // Goalkeeper glove / shield
      return (
        <svg {...p}>
          <path {...S} d="M12 3.5c2.4 1.4 4.7 2 7 2 0 6-2.7 10.4-7 13-4.3-2.6-7-7-7-13 2.3 0 4.6-.6 7-2Z" />
          <path {...S} d="m9 12 2 2 4-4" />
        </svg>
      );
    case "spread":
      // Handicap scale
      return (
        <svg {...p}>
          <path {...S} d="M12 4v16M5 8h14" />
          <path {...S} d="M5 8 3 13a2.2 2.2 0 0 0 4 0L5 8ZM19 8l-2 5a2.2 2.2 0 0 0 4 0l-2-5Z" />
          <path {...S} d="M9 20h6" />
        </svg>
      );
    case "double_chance":
      // Split / two-way shield
      return (
        <svg {...p}>
          <path {...S} d="M12 3.5c2.4 1.4 4.7 2 7 2 0 6-2.7 10.4-7 13-4.3-2.6-7-7-7-13 2.3 0 4.6-.6 7-2Z" />
          <path {...S} d="M12 5.5v13" />
        </svg>
      );
    case "draw":
      // Equals
      return (
        <svg {...p}>
          <path {...S} d="M6 9.5h12M6 14.5h12" />
        </svg>
      );
    case "first_half_winner":
      // Clock (half)
      return (
        <svg {...p}>
          <circle {...S} cx="12" cy="12" r="8.5" />
          <path {...S} d="M12 7.5V12l3 1.8" />
        </svg>
      );
    default:
      // Generic market
      return (
        <svg {...p}>
          <path {...S} d="M4 15l5-5 3.5 3.5L20 6" />
          <path {...S} d="M15 6h5v5" />
        </svg>
      );
  }
}
