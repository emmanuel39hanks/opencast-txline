/**
 * TxLINE proof → on-chain settlement helpers. This is the exact logic proven
 * end-to-end against a live match: find an anchored proof, transform it into
 * the txoracle `StatValidationInput`, and derive the daily-scores root PDA.
 *
 * Server-only (uses the API token).
 */
import { BN, web3 } from "@coral-xyz/anchor";
import { getScoreSnapshot, getStatValidation } from "./client";
import type { TxProofNode, TxStatValidation } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Walk back from the latest score record until a stat-validation proof is
 * available (very recent records aren't anchored on-chain yet). Returns the
 * proof + the seq it came from, or null.
 */
export async function findAnchoredProof(
  fixtureId: number,
  statKeys: number[],
  lookback = 60,
): Promise<{ proof: TxStatValidation; seq: number } | null> {
  const snap = await getScoreSnapshot(fixtureId);
  for (let i = snap.length - 1; i >= 0 && i >= snap.length - lookback; i--) {
    const seq = snap[i].Seq;
    try {
      const proof = await getStatValidation(fixtureId, seq, statKeys);
      return { proof, seq };
    } catch {
      // 404 = not anchored yet; keep walking back.
    }
  }
  return null;
}

const mapNode = (n: TxProofNode) => ({
  hash: n.hash,
  isRightSibling: !!(n.isRightSibling ?? (n as { is_right_sibling?: boolean }).is_right_sibling),
});

/**
 * Transform a TxLINE proof into the Anchor `StatValidationInput` arg. txoracle
 * keys the daily-scores root + its seed check on `summary.updateStats.minTimestamp`,
 * so that is the payload `ts`.
 */
export function buildStatValidationPayload(proof: TxStatValidation) {
  const targetTs = proof.summary.updateStats.minTimestamp;
  return {
    payload: {
      ts: new BN(targetTs),
      fixtureSummary: {
        fixtureId: new BN(proof.summary.fixtureId),
        updateStats: {
          updateCount: proof.summary.updateStats.updateCount,
          minTimestamp: new BN(proof.summary.updateStats.minTimestamp),
          maxTimestamp: new BN(proof.summary.updateStats.maxTimestamp),
        },
        eventsSubTreeRoot: proof.summary.eventStatsSubTreeRoot,
      },
      fixtureProof: proof.subTreeProof.map(mapNode),
      mainTreeProof: proof.mainTreeProof.map(mapNode),
      eventStatRoot: proof.eventStatRoot,
      stats: proof.statsToProve.map((s, i) => ({
        stat: { key: s.key, value: s.value, period: s.period },
        statProof: proof.statProofs[i].map(mapNode),
      })),
    },
    targetTs,
  };
}

/** Derive the txoracle daily-scores root PDA for a proof's epoch day (u16 LE). */
export function dailyScoresRootPda(
  targetTs: number,
  txoracleProgramId: web3.PublicKey,
): web3.PublicKey {
  const epochDay = Math.floor(targetTs / DAY_MS);
  const edBuf = Buffer.alloc(2);
  edBuf.writeUInt16LE(epochDay);
  const [pda] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("daily_scores_roots"), edBuf],
    txoracleProgramId,
  );
  return pda;
}
