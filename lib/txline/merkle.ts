/**
 * Independent Merkle verification of TxLINE stat proofs.
 *
 * TxLINE's tree uses plain sha256 pair-hashing; each proof node carries the
 * sibling hash and its side (`isRightSibling` → sibling is concatenated
 * second). We verified this empirically against known roots: folding
 * `eventStatRoot` through `subTreeProof` reproduces
 * `summary.eventStatsSubTreeRoot` byte-for-byte.
 *
 * That gives us a check gate that doesn't trust TxLINE's word or our own
 * chain reads: a tampered or inconsistent proof fails recomputation before
 * we display it — and before the keeper settles against it.
 */
import { createHash } from "crypto";

export interface ProofNode {
  hash: number[];
  isRightSibling: boolean;
}

export type IndependentCheck = "recomputed-ok" | "mismatch" | "unavailable";

const sha256 = (b: Buffer) => createHash("sha256").update(b).digest();

/** Fold a Merkle path upward: sibling concatenated second when it's right. */
export function foldPath(start: Buffer, path: ProofNode[]): Buffer {
  let acc = start;
  for (const n of path) {
    const sib = Buffer.from(n.hash);
    acc = sha256(
      n.isRightSibling ? Buffer.concat([acc, sib]) : Buffer.concat([sib, acc]),
    );
  }
  return acc;
}

/**
 * Recompute the daily sub-tree root from the event-stat root and the proof's
 * own path, and compare with the root the proof claims. Deterministic, pure.
 */
export function verifyProofChain(proof: {
  eventStatRoot?: number[];
  summary?: { eventStatsSubTreeRoot?: number[] };
  subTreeProof?: ProofNode[];
}): IndependentCheck {
  const root = proof?.eventStatRoot;
  const target = proof?.summary?.eventStatsSubTreeRoot;
  const path = proof?.subTreeProof;
  if (!root?.length || !target?.length || !path?.length) return "unavailable";
  try {
    const got = foldPath(Buffer.from(root), path);
    return got.equals(Buffer.from(target)) ? "recomputed-ok" : "mismatch";
  } catch {
    return "unavailable";
  }
}
