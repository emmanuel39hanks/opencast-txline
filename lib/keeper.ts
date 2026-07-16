/**
 * Settlement keeper core — shared by the manual settle endpoints and the
 * auto-settle cron. Settlement is trustless either way: the keeper only relays
 * TxLINE Merkle proofs; the predicate check happens on-chain via CPI into
 * txoracle.validate_stat_v2.
 */
import { web3 } from "@coral-xyz/anchor";
import {
  getServerProgram,
  serviceKeypair,
  TXORACLE_PROGRAM_ID,
  SETTLEMENT_PROGRAM_ID,
} from "@/lib/solana/server";

/** The parlay bankroll PDA (v2 layout with liability reservation). */
export function treasuryPda(): web3.PublicKey {
  return web3.PublicKey.findProgramAddressSync(
    [Buffer.from("treasury_v2")],
    SETTLEMENT_PROGRAM_ID,
  )[0];
}
import { getScoreSnapshot } from "@/lib/txline/client";
import { verifyProofChain } from "@/lib/txline/merkle";
import {
  buildStatValidationPayload,
  dailyScoresRootPda,
  findAnchoredProof,
} from "@/lib/txline/proof";

const CU = () => web3.ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 });

/**
 * A fixture is settleable once TxLINE marks it finished — FT / after ET /
 * after pens. Per the soccer-feed docs that's `game_finalised`, GamePhase
 * "F"/"FET"/"FPE", or StatusId 5/10/13. Scans the whole snapshot (the final
 * marker isn't always the last record).
 */
export async function isFixtureFinal(fixtureId: number): Promise<boolean> {
  try {
    const snap = await getScoreSnapshot(fixtureId);
    for (let i = snap.length - 1; i >= 0; i--) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r: any = snap[i];
      if (String(r?.Action) === "game_finalised") return true;
      const phase = String(r?.GamePhase ?? "");
      if (phase === "F" || phase === "FET" || phase === "FPE") return true;
      const st = Number(r?.StatusId ?? 0);
      if (st === 5 || st === 10 || st === 13) return true;
    }
    return false;
  } catch {
    return false;
  }
}

/** Settle a single-predicate market by PDA. Throws on hard errors. */
export async function settleMarketByPda(marketPda: string) {
  const program = getServerProgram();
  const market = new web3.PublicKey(marketPda);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const acct = (program.account as any).market;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const m: any = await acct.fetch(market);
  if (m.settled) {
    return { settled: true as const, already: true, outcome: Number(m.outcome) };
  }

  const fixtureId = Number(m.fixtureId);
  const statKeys = [Number(m.statKeyA), Number(m.statKeyB)].filter((k) => k !== 0);
  const found = await findAnchoredProof(fixtureId, statKeys);
  if (!found) {
    return { settled: false as const, pending: "no anchored proof yet" };
  }

  // Independent check gate: recompute the proof's Merkle chain ourselves
  // (sha256 pair-hashing) before trusting it with settlement. The chain
  // would reject a bad proof anyway — this catches it earlier and cheaper,
  // and never lets a proof that doesn't reconcile reach the program.
  if (verifyProofChain(found.proof) === "mismatch") {
    return {
      settled: false as const,
      pending: "proof failed independent Merkle recomputation — refusing to settle",
    };
  }

  const { payload, targetTs } = buildStatValidationPayload(found.proof);
  const dailyScores = dailyScoresRootPda(targetTs, TXORACLE_PROGRAM_ID);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const txSig = await (program.methods as any)
    .settleMarket(payload)
    .accounts({
      keeper: serviceKeypair().publicKey,
      market,
      dailyScoresMerkleRoots: dailyScores,
      txoracleProgram: TXORACLE_PROGRAM_ID,
    })
    .preInstructions([CU()])
    .rpc();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updated: any = await acct.fetch(market);
  return {
    settled: true as const,
    outcome: Number(updated.outcome), // 1 YES, 2 NO
    txSig,
    seq: found.seq,
    score: found.proof.statsToProve,
    // Full proof for persistence — receipts must outlive TxLINE API access.
    proof: found.proof,
  };
}

/** Prove every unproven leg of a parlay ticket, then finalize it. */
export async function settleParlayByPda(betPda: string) {
  const program = getServerProgram();
  const keeper = serviceKeypair().publicKey;
  const bet = new web3.PublicKey(betPda);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const b: any = await (program.account as any).parlayBet.fetch(bet);
  if (b.settled) {
    return { settled: true as const, already: true, won: Boolean(b.won) };
  }

  const evaluated = Number(b.evaluated);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const legs = (b.legs as any[]).map((l) => ({
    fixtureId: Number(l.fixtureId),
    statKeyA: Number(l.statKeyA),
    statKeyB: Number(l.statKeyB),
  }));
  const legSigs: { leg: number; sig: string; seq: number }[] = [];

  for (let i = 0; i < legs.length; i++) {
    if (evaluated & (1 << i)) continue;
    const leg = legs[i];
    const keys = leg.statKeyB ? [leg.statKeyA, leg.statKeyB] : [leg.statKeyA];
    const found = await findAnchoredProof(leg.fixtureId, keys);
    if (!found) {
      return {
        settled: false as const,
        pending: `no anchored proof yet for leg ${i + 1} (fixture ${leg.fixtureId})`,
      };
    }
    const { payload, targetTs } = buildStatValidationPayload(found.proof);
    const dailyScores = dailyScoresRootPda(targetTs, TXORACLE_PROGRAM_ID);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sig = await (program.methods as any)
      .proveLeg(i, payload)
      .accounts({
        keeper,
        bet,
        dailyScoresMerkleRoots: dailyScores,
        txoracleProgram: TXORACLE_PROGRAM_ID,
      })
      .preInstructions([CU()])
      .rpc();
    legSigs.push({ leg: i, sig, seq: found.seq });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const finalizeSig = await (program.methods as any)
    .finalizeParlay()
    .accounts({ keeper, bet, treasury: treasuryPda() })
    .rpc();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updated: any = await (program.account as any).parlayBet.fetch(bet);
  return {
    settled: true as const,
    won: Boolean(updated.won),
    legSigs,
    finalizeSig,
  };
}
