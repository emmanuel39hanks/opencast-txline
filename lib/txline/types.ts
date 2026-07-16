/**
 * TxLINE data shapes (soccer / World Cup). Field names mirror the TxLINE
 * JSON exactly (PascalCase) so raw responses pass straight through.
 */

/**
 * Real TxLINE fixture shape (verified live from the devnet feed). StartTime/Ts
 * are unix milliseconds. Competition = "World Cup", CompetitionId = 72.
 */
export interface TxFixture {
  FixtureId: number;
  Ts: number; // unix ms — last update
  StartTime: number; // unix ms — kickoff
  Competition: string; // e.g. "World Cup"
  CompetitionId: number; // 72 for World Cup
  FixtureGroupId?: number;
  Participant1Id: number;
  Participant1: string; // home (when Participant1IsHome)
  Participant2Id: number;
  Participant2: string; // away
  Participant1IsHome: boolean;
  /** 1 = scheduled/pre-match; higher = in-play/other states. */
  GameState?: number;
}

/** One encoded stat inside a score record. Stat key = period*1000 + base. */
export interface TxStat {
  StatKey: number;
  Value: number;
}

export interface TxScoreRecord {
  FixtureId: number;
  Seq: number;
  Ts: number; // unix ms
  Stats?: TxStat[];
  /** e.g. "F" (finished), "FET", "FPE"; or action="game_finalised". */
  GamePhase?: string;
  Action?: string;
  StatusId?: number;
  Period?: number;
}

/**
 * Proof payload returned by GET /scores/stat-validation (verified live shape).
 * Maps 1:1 onto the on-chain txoracle `StatValidationInput`:
 *   ts → ts · summary → fixture_summary · subTreeProof → fixture_proof ·
 *   mainTreeProof → main_tree_proof · eventStatRoot → event_stat_root ·
 *   zip(statsToProve, statProofs) → stats[{ stat, stat_proof }].
 */
export interface TxProofNode {
  hash: number[]; // 32 bytes
  isRightSibling: boolean;
}

export interface TxScoreStat {
  key: number;
  value: number;
  period: number;
}

export interface TxStatValidation {
  ts: number;
  statsToProve: TxScoreStat[];
  eventStatRoot: number[]; // 32 bytes
  summary: {
    fixtureId: number;
    updateStats: {
      updateCount: number;
      minTimestamp: number;
      maxTimestamp: number;
    };
    eventStatsSubTreeRoot: number[]; // 32 bytes
  };
  statProofs: TxProofNode[][];
  subTreeProof: TxProofNode[];
  mainTreeProof: TxProofNode[];
}

// ─── Soccer stat-key encoding ──────────────────────────────────────────────
// base 1-8 = P1/P2 goals(1,2), yellow(3,4), red(5,6), corners(7,8).
// period prefix ×1000: 0 total, 1 first-half(1000), 2 HT, 3 second-half(3000),
// 4/5 ET halves, 6 pens, 7 ET total.

export const STAT_BASE = {
  GOALS_P1: 1,
  GOALS_P2: 2,
  YELLOW_P1: 3,
  YELLOW_P2: 4,
  RED_P1: 5,
  RED_P2: 6,
  CORNERS_P1: 7,
  CORNERS_P2: 8,
} as const;

export const PERIOD = {
  TOTAL: 0,
  FIRST_HALF: 1000,
  HALFTIME: 2000,
  SECOND_HALF: 3000,
  ET_FIRST: 4000,
  ET_SECOND: 5000,
  PENALTIES: 6000,
  ET_TOTAL: 7000,
} as const;

/** Compose a full stat key from a base stat and a period. */
export function statKey(base: number, period: number = PERIOD.TOTAL): number {
  return period + base;
}
