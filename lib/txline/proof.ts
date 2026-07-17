/**
 * TxLINE proof → on-chain settlement helpers. This is the exact logic proven
 * end-to-end against a live match: find an anchored proof, transform it into
 * the txoracle `StatValidationInput`, and derive the daily-scores root PDA.
 *
 * Server-only (uses the API token).
 */
import { BN, web3 } from "@coral-xyz/anchor";
import { getScoreSnapshot, getStatValidation } from "./client";
import { verifyProofChain } from "./merkle";
import type { TxProofNode, TxStatValidation } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Full-time / after-ET / after-pens markers, per the soccer-feed docs. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isFinalRecord(r: any): boolean {
  if (String(r?.Action) === "game_finalised") return true;
  const phase = String(r?.GamePhase ?? "");
  if (phase === "F" || phase === "FET" || phase === "FPE") return true;
  const st = Number(r?.StatusId ?? 0);
  return st === 5 || st === 10 || st === 13;
}

/**
 * Find the newest score record with an anchored, self-consistent proof.
 *
 * Two hard-won production lessons live here:
 *  1. The snapshot array is NOT chronologically ordered — records arrive in
 *     arbitrary order, so we sort by Seq ourselves. (Walking the raw array
 *     "backwards" once handed us a mid-match 0–0 record as "latest".)
 *  2. Once a fixture has a full-time record, settlement must only ever prove
 *     a record at/after that final whistle — an earlier seq would prove a
 *     provisional score. Post-final amends may still correct stats, so we
 *     prefer the newest seq and walk back no further than full-time.
 *
 * Each candidate proof is recomputed through the independent Merkle gate
 * before it's accepted: a proof that doesn't reconcile with its own summary
 * root is skipped (we've observed TxLINE serve such records), never settled.
 */
export async function findAnchoredProof(
  fixtureId: number,
  statKeys: number[],
  lookback = 60,
): Promise<{ proof: TxStatValidation; seq: number } | null> {
  const snap = await getScoreSnapshot(fixtureId);
  const seqsAsc = [...snap]
    .sort((a, b) => Number(a.Seq) - Number(b.Seq))
    .map((r) => ({ seq: Number(r.Seq), final: isFinalRecord(r) }));
  const finalSeq = seqsAsc.filter((r) => r.final).map((r) => r.seq).pop();
  const candidates = seqsAsc
    .map((r) => r.seq)
    .filter((s) => (finalSeq == null ? true : s >= finalSeq))
    .reverse(); // newest first

  let tried = 0;
  for (const seq of candidates) {
    if (tried >= lookback) break;
    tried++;
    try {
      const proof = await getStatValidation(fixtureId, seq, statKeys);
      if (verifyProofChain(proof) === "mismatch") continue; // inconsistent record
      return { proof, seq };
    } catch {
      // 404 = not anchored yet; keep walking back (never past full-time).
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
