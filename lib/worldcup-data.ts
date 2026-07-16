/**
 * Curated World Cup 2026 market templates for the /worldcup landing.
 *
 * Used by the silly-bets grid, the match schedule, and the bracket
 * preview. Pre-tournament: questions can be split between "serious"
 * (will-Argentina-win) and "silly" (will-anyone-do-SIUUU) for the fun
 * filter pill on the page. Once the actual draw lands, swap the
 * fixtures + countries into the real bracket.
 */

export type WorldCupTone = "serious" | "silly" | "live";

export interface WorldCupBet {
  id: string;
  question: string;
  tone: WorldCupTone;
  /** Card surface colour. */
  tint: "lime" | "amber" | "sky" | "rose" | "lavender" | "ink";
  /** Optional sticker label (e.g. "Final", "Group A", "Player prop"). */
  tag: string;
  yesPct: number;
}

export const WORLDCUP_BETS: WorldCupBet[] = [
  // ─── Big questions ────────────────────────────────────────────────────────
  {
    id: "argentina-back-to-back",
    question: "Will Argentina win back-to-back World Cups?",
    tone: "serious",
    tint: "sky",
    tag: "Champion",
    yesPct: 18,
  },
  {
    id: "host-semifinal",
    question: "Will the USA reach the semifinal?",
    tone: "serious",
    tint: "lime",
    tag: "Host nation",
    yesPct: 27,
  },
  {
    id: "france-or-brazil-final",
    question: "Will France OR Brazil reach the final?",
    tone: "serious",
    tint: "amber",
    tag: "Top half",
    yesPct: 61,
  },
  {
    id: "messi-last-dance",
    question: "Will Messi score in this tournament?",
    tone: "serious",
    tint: "rose",
    tag: "Player prop",
    yesPct: 72,
  },

  // ─── Silly bets ───────────────────────────────────────────────────────────
  {
    id: "siuuu",
    question: "Will any player celebrate with a SIUUU?",
    tone: "silly",
    tint: "lavender",
    tag: "Vibes",
    yesPct: 88,
  },
  {
    id: "messi-cries",
    question: "Will Messi cry on camera?",
    tone: "silly",
    tint: "rose",
    tag: "Emotion",
    yesPct: 64,
  },
  {
    id: "streaker",
    question: "Will a streaker invade the pitch?",
    tone: "silly",
    tint: "amber",
    tag: "Chaos",
    yesPct: 41,
  },
  {
    id: "keeper-goal",
    question: "Will a goalkeeper score a goal?",
    tone: "silly",
    tint: "ink",
    tag: "Once in a lifetime",
    yesPct: 7,
  },
  {
    id: "red-card-opener",
    question: "Red card in the opening match before 60'?",
    tone: "silly",
    tint: "rose",
    tag: "Group A",
    yesPct: 22,
  },
  {
    id: "var-overturns-final",
    question: "Will VAR overturn a goal in the final?",
    tone: "silly",
    tint: "sky",
    tag: "Drama",
    yesPct: 34,
  },
  {
    id: "underdog-quarter",
    question: "Will an underdog reach the quarterfinal?",
    tone: "silly",
    tint: "lime",
    tag: "Cinderella",
    yesPct: 58,
  },
  {
    id: "penalties-final",
    question: "Will the final go to penalties?",
    tone: "silly",
    tint: "amber",
    tag: "Heartbreak",
    yesPct: 28,
  },
];

export interface WorldCupMatch {
  id: string;
  /** Display label like "Match 1 · Opener". */
  label: string;
  homeFlag: string;
  homeName: string;
  awayFlag: string;
  awayName: string;
  /** ISO date — mostly placeholders until the draw lands. */
  kickoffISO: string;
  /** Featured market question for the match card. */
  marketQuestion: string;
  yesPct: number;
}

export const WORLDCUP_FEATURED_MATCHES: WorldCupMatch[] = [
  {
    id: "opener-2026-06-11",
    label: "Match 1 · Opener",
    homeFlag: "🇲🇽",
    homeName: "Mexico",
    awayFlag: "🇺🇸",
    awayName: "USA",
    kickoffISO: "2026-06-11T20:00:00.000Z",
    marketQuestion: "Will both teams score?",
    yesPct: 67,
  },
  {
    id: "group-d-rivalry",
    label: "Match 9 · Group D",
    homeFlag: "🇫🇷",
    homeName: "France",
    awayFlag: "🇧🇷",
    awayName: "Brazil",
    kickoffISO: "2026-06-14T19:00:00.000Z",
    marketQuestion: "Over 2.5 goals?",
    yesPct: 73,
  },
  {
    id: "messi-vs-ronaldo",
    label: "Match 14 · Group G",
    homeFlag: "🇦🇷",
    homeName: "Argentina",
    awayFlag: "🇵🇹",
    awayName: "Portugal",
    kickoffISO: "2026-06-16T22:00:00.000Z",
    marketQuestion: "Will Messi score?",
    yesPct: 58,
  },
  {
    id: "final-2026-07-19",
    label: "Final · MetLife Stadium",
    homeFlag: "🏆",
    homeName: "Winner",
    awayFlag: "🏆",
    awayName: "Winner",
    kickoffISO: "2026-07-19T18:00:00.000Z",
    marketQuestion: "Goes to penalties?",
    yesPct: 28,
  },
];

export const WORLDCUP_OPENING_ISO = "2026-06-11T20:00:00.000Z";
export const WORLDCUP_FINAL_ISO = "2026-07-19T18:00:00.000Z";
