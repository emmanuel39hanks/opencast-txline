/**
 * Maps a market to the TxLINE stat-validation strategy our Solana program
 * stores and settles against. A "strategy" is the YES condition expressed over
 * TxLINE ScoreStat keys: `(a [±] b) <cmp> threshold`.
 *
 * Soccer stat keys = period*1000 + base. base 1/2 = P1/P2 goals, 3/4 yellow,
 * 5/6 red, 7/8 corners. period 0 = full match.
 */
import type { TxFixture } from "./types";

export const COMPARISON = { GT: 0, LT: 1, EQ: 2 } as const;

/** ScoreStat keys for full-match goals. */
export const GOALS_P1 = 1;
export const GOALS_P2 = 2;

export interface MarketStrategy {
  /** ScoreStat key for term A (index 0 in the proof). */
  statKeyA: number;
  /** ScoreStat key for term B (index 1), or 0 for a single-term predicate. */
  statKeyB: number;
  /** Compared threshold. */
  threshold: number;
  /** 0 GreaterThan · 1 LessThan · 2 EqualTo. */
  comparison: number;
  /** Human labels. */
  question: string;
  yesLabel: string;
  noLabel: string;
}

/**
 * "Will {home} beat {away}?" — home_goals − away_goals > 0.
 * Keys are ordered [home, away] so the on-chain predicate (index 0 − index 1)
 * always means home minus away regardless of which participant is home.
 */
export function matchWinnerStrategy(fx: TxFixture): MarketStrategy {
  const home = fx.Participant1IsHome ? fx.Participant1 : fx.Participant2;
  const away = fx.Participant1IsHome ? fx.Participant2 : fx.Participant1;
  const homeKey = fx.Participant1IsHome ? GOALS_P1 : GOALS_P2;
  const awayKey = fx.Participant1IsHome ? GOALS_P2 : GOALS_P1;
  return {
    statKeyA: homeKey,
    statKeyB: awayKey,
    threshold: 0,
    comparison: COMPARISON.GT,
    question: `Will ${home} beat ${away}?`,
    yesLabel: home,
    noLabel: away,
  };
}

/** Over/Under total goals — (P1 goals + P2 goals) > line. */
export function overGoalsStrategy(fx: TxFixture, line: number): MarketStrategy {
  return {
    statKeyA: GOALS_P1,
    statKeyB: GOALS_P2,
    threshold: line,
    comparison: COMPARISON.GT,
    question: `Over ${line + 0.5} goals in ${fx.Participant1} vs ${fx.Participant2}?`,
    yesLabel: `Over ${line + 0.5}`,
    noLabel: `Under ${line + 0.5}`,
    // NB: uses an Add binary op — supported once the program's op field lands.
  };
}

/** The statKeys array the settle keeper requests from /scores/stat-validation. */
export function strategyStatKeys(s: MarketStrategy): number[] {
  return s.statKeyB === 0 ? [s.statKeyA] : [s.statKeyA, s.statKeyB];
}
