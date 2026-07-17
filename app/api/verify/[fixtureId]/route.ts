import { NextResponse } from "next/server";
import {
  getAllTournamentFixtures,
  getScoreSnapshot,
  getStatValidation,
  isFinal,
} from "@/lib/txline/client";
import { findAnchoredProof, dailyScoresRootPda } from "@/lib/txline/proof";
import { parseMatch } from "@/lib/txline/match";
import { statKeyLabel, describePredicate } from "@/lib/txline/predicate";
import { verifyProofChain } from "@/lib/txline/merkle";
import { TXORACLE_PROGRAM_ID } from "@/lib/solana/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/verify/[fixtureId]?m=<marketPda> → the TxLINE Merkle proof for a
 * fixture's stats — the exact data our Solana program checks to settle — made
 * legible: named stat leaves, the market's YES condition in plain English,
 * and proof-size metrics. `m` targets a specific market on the fixture
 * (several can exist); without it we fall back to the first one.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ fixtureId: string }> },
) {
  const { fixtureId } = await params;
  const fid = Number(fixtureId);
  const url = new URL(req.url);
  const marketPda = url.searchParams.get("m");

  try {
    const [dbms, fixtures] = await Promise.all([
      prisma.market.findMany({ where: { fixtureId: fid } }).catch(() => []),
      getAllTournamentFixtures().catch(() => []),
    ]);
    const dbm =
      (marketPda && dbms.find((m) => m.marketPda === marketPda)) || dbms[0] || null;
    const fx = fixtures.find((f) => f.FixtureId === fid);
    // TxLINE stat keys are Participant1/Participant2-relative.
    const p1 = fx?.Participant1 ?? dbm?.yesLabel ?? "Team A";
    const p2 = fx?.Participant2 ?? dbm?.noLabel ?? "Team B";

    // The market's stored predicate — what settlement will actually prove.
    const strat = (dbm?.strategy ?? {}) as {
      statKeyA?: number;
      statKeyB?: number;
      threshold?: number;
      comparison?: number;
    };
    const statKeyA = Number(strat.statKeyA ?? (dbm?.statKeys as number[])?.[0] ?? 1);
    const statKeyB = Number(strat.statKeyB ?? (dbm?.statKeys as number[])?.[1] ?? 2);
    const threshold = Number(strat.threshold ?? 0);
    const comparison = Number(strat.comparison ?? 0);
    const statKeys = statKeyB !== 0 ? [statKeyA, statKeyB] : [statKeyA];

    // Live proof first; the snapshot stored at settlement is the fallback so
    // receipts keep working after TxLINE API access ends.
    let scores: Awaited<ReturnType<typeof getScoreSnapshot>> = [];
    let proof: Awaited<ReturnType<typeof getStatValidation>> | null = null;
    let seq = 0;
    let finalNow = false;
    let fromSnapshot = false;
    try {
      // The snapshot array is NOT chronologically ordered — sort by Seq so
      // "latest" and player facts mean what they say.
      scores = (await getScoreSnapshot(fid))
        .slice()
        .sort((a, b) => Number(a.Seq) - Number(b.Seq));
      if (scores.length) {
        // Finality markers (game_finalised / GamePhase F) can land
        // mid-snapshot, followed by coverage updates — scan the whole history.
        finalNow = scores.some((r) => isFinal(r));
        // Same selection the keeper settles with: newest anchored,
        // self-consistent proof, never older than the final whistle.
        const found = await findAnchoredProof(fid, statKeys);
        if (found) {
          proof = found.proof;
          seq = found.seq;
        }
      }
    } catch {
      /* fall through to the stored snapshot */
    }
    if (!proof && dbm?.proofJson) {
      proof = dbm.proofJson as unknown as Awaited<
        ReturnType<typeof getStatValidation>
      >;
      finalNow = dbm.status === "RESOLVED";
      fromSnapshot = true;
    }
    if (!proof) {
      return NextResponse.json({
        available: false,
        reason:
          "TxLINE hasn't published score data for this fixture yet — there is nothing to prove until the feed emits.",
        question: dbm?.question ?? null,
        home: fx ? (fx.Participant1IsHome ? p1 : p2) : null,
        away: fx ? (fx.Participant1IsHome ? p2 : p1) : null,
      });
    }

    // Player facts: the lineups action names every player; the final record's
    // PlayerStats attributes goals/cards to player ids. Together they let the
    // receipt read "Torres (goal)" instead of a bare number.
    const playerFacts = extractPlayerFacts(
      scores as unknown as Array<Record<string, unknown>>,
    );

    // Name every proven leaf: key 1001 → "France goals (1st half)".
    const namedStats = (proof.statsToProve ?? []).map(
      (s: { key: number; value: number }) => ({
        key: Number(s.key),
        label: statKeyLabel(Number(s.key), p1, p2),
        value: Number(s.value),
      }),
    );

    // Evaluate the predicate against the proven values — what the chain will
    // conclude if settled at this sequence.
    const valOf = (k: number) =>
      namedStats.find((s: { key: number }) => s.key === k)?.value;
    const a = valOf(statKeyA);
    const b = statKeyB !== 0 ? valOf(statKeyB) : 0;
    let impliedOutcome: "Yes" | "No" | null = null;
    if (a != null && (statKeyB === 0 || b != null)) {
      const diff = a - (b ?? 0);
      const holds =
        comparison === 0
          ? diff > threshold
          : comparison === 1
            ? diff < threshold
            : diff === threshold;
      impliedOutcome = holds ? "Yes" : "No";
    }

    // Proof-size metrics: how many sibling hashes connect the leaves to the
    // on-chain root.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = proof as any;
    const statHashes = (p.statProofs ?? []).reduce(
      (acc: number, path: unknown[]) => acc + (path?.length ?? 0),
      0,
    );
    const proofMetrics = {
      updateCount: p.summary?.updateStats?.updateCount ?? null,
      firstUpdate: p.summary?.updateStats?.minTimestamp ?? null,
      lastUpdate: p.summary?.updateStats?.maxTimestamp ?? null,
      statHashes,
      subTreeHashes: p.subTreeProof?.length ?? 0,
      mainTreeHashes: p.mainTreeProof?.length ?? 0,
      totalHashes:
        statHashes + (p.subTreeProof?.length ?? 0) + (p.mainTreeProof?.length ?? 0),
    };

    // Final scoreboard for receipts — parsed from the same sequenced records
    // the proof commits to, so the score shown is the score proven.
    const homeName = fx ? (fx.Participant1IsHome ? p1 : p2) : p1;
    const awayName = fx ? (fx.Participant1IsHome ? p2 : p1) : p2;
    let score: { home: number; away: number; final: boolean } | null = null;
    if (scores.length) {
      const md = parseMatch(
        fid,
        homeName,
        awayName,
        fx?.Participant1IsHome ?? true,
        scores as unknown as never[],
      );
      score = { home: md.goals[0], away: md.goals[1], final: md.final };
    }

    // The exact on-chain account the proof's daily root is anchored in —
    // the most concrete "don't trust us" link we can offer.
    let dailyRootPda: string | null = null;
    try {
      const ts = Number(p.summary?.updateStats?.minTimestamp);
      if (Number.isFinite(ts) && ts > 0) {
        dailyRootPda = dailyScoresRootPda(ts, TXORACLE_PROGRAM_ID).toBase58();
      }
    } catch {
      /* cosmetic only */
    }

    return NextResponse.json({
      available: true,
      fixtureId: fid,
      seq,
      final: finalNow,
      // Match context
      home: fx ? (fx.Participant1IsHome ? p1 : p2) : null,
      away: fx ? (fx.Participant1IsHome ? p2 : p1) : null,
      score,
      // Market context
      question: dbm?.question ?? null,
      yesLabel: dbm?.yesLabel ?? null,
      noLabel: dbm?.noLabel ?? null,
      marketPda: dbm?.marketPda ?? null,
      marketStatus: dbm?.status ?? null,
      marketOutcome: dbm?.outcome ?? null,
      settleTxSig: dbm?.settleTxSig ?? null,
      dailyRootPda,
      marketsOnFixture: dbms.filter((m) => m.marketPda).length,
      predicate: describePredicate(
        { statKeyA, statKeyB, threshold, comparison },
        p1,
        p2,
      ),
      // Raw predicate parts so the UI can show the settlement math as an
      // equation, not just prose.
      predicateParts: { statKeyA, statKeyB, threshold, comparison },
      statKeys,
      namedStats,
      impliedOutcome,
      proofMetrics,
      playerFacts,
      // Custom check gate: we recompute the proof's Merkle chain ourselves
      // (sha256 pair-hashing) instead of taking the feed's word for it.
      independentCheck: verifyProofChain(proof),
      fromSnapshot,
      proof,
    });
  } catch (e) {
    return NextResponse.json({ available: false, error: (e as Error).message });
  }
}

/** "Akliouche, Maghnes" → "M. Akliouche" */
function shortName(preferred: string): string {
  const [last, first] = preferred.split(", ");
  return first ? `${first[0]}. ${last}` : preferred;
}

/**
 * Cross-reference the lineups action (player id → name) with the final
 * record's PlayerStats (player id → goals/cards) into human-readable facts.
 */
function extractPlayerFacts(records: Array<Record<string, unknown>>): {
  goals: string[];
  yellows: string[];
  reds: string[];
} | null {
  const empty = { goals: [], yellows: [], reds: [] };
  try {
    // 1) id → name from lineups.
    const names = new Map<number, string>();
    const lu = records.find((r) => String(r.Action) === "lineups") as
      | { Lineups?: Array<{ lineups?: Array<{ player?: { normativeId?: number; preferredName?: string } }> }> }
      | undefined;
    for (const team of lu?.Lineups ?? []) {
      for (const entry of team.lineups ?? []) {
        if (entry.player?.normativeId && entry.player.preferredName) {
          names.set(entry.player.normativeId, shortName(entry.player.preferredName));
        }
      }
    }

    // 2) The richest PlayerStats payload (usually on game_finalised).
    type PlayerStats = Record<string, Record<string, Record<string, number>>>;
    let stats: PlayerStats | null = null;
    for (const r of records) {
      if (r.PlayerStats && typeof r.PlayerStats === "object") {
        stats = r.PlayerStats as PlayerStats;
      }
    }
    if (!stats) return null;

    const facts = { goals: [] as string[], yellows: [] as string[], reds: [] as string[] };
    for (const side of Object.values(stats)) {
      for (const [pid, s] of Object.entries(side)) {
        const name = names.get(Number(pid)) ?? `#${pid}`;
        const goals = (s.goals ?? 0) + (s.penaltyGoals ?? 0);
        if (goals > 0) facts.goals.push(goals > 1 ? `${name} ×${goals}` : name);
        if ((s.yellowCards ?? 0) > 0) facts.yellows.push(name);
        if ((s.redCards ?? 0) > 0) facts.reds.push(name);
      }
    }
    return facts.goals.length || facts.yellows.length || facts.reds.length
      ? facts
      : empty;
  } catch {
    return null;
  }
}
