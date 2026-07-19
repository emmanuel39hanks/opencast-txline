import { NextResponse } from "next/server";
import { web3 } from "@coral-xyz/anchor";
import { prisma } from "@/lib/db";
import { getServerProgram } from "@/lib/solana/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/parlay/[pda] → one parlay ticket: its legs (rich display data from
 * the DB) + live on-chain state (stake, payout, per-leg proven/passed bitmaps,
 * settled / won / claimed).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ pda: string }> },
) {
  try {
    const { pda } = await params;
    const row = await prisma.parlayBet.findUnique({ where: { betPda: pda } });
    if (!row) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

    const program = getServerProgram();
    let chain: {
      stake: number;
      payout: number;
      evaluated: number;
      passed: number;
      settled: boolean;
      won: boolean;
      claimed: boolean;
      owner: string;
      idSeed: string;
    } | null = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const c: any = await (program.account as any).parlayBet.fetch(
        new web3.PublicKey(pda),
      );
      chain = {
        stake: Number(c.stake) / 1e6,
        payout: Number(c.payout) / 1e6,
        evaluated: Number(c.evaluated),
        passed: Number(c.passed),
        settled: Boolean(c.settled),
        won: Boolean(c.won),
        claimed: Boolean(c.claimed),
        owner: c.owner.toBase58(),
        idSeed: c.id.toBase58(),
      };
    } catch {
      /* not found on-chain */
    }

    // Per-leg preview: a leg's underlying market may already be RESOLVED (by
    // its own on-chain proof) before the ticket finalizes — surface hit/miss
    // so a settled match never reads as "pending".
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const legsRaw = ((row.legs as any[]) ?? []).map((l) => ({ ...l }));
    const pdas = legsRaw
      .map((l) => l?.marketPda)
      .filter((p): p is string => typeof p === "string" && p.length > 0);
    if (pdas.length) {
      const markets = await prisma.market.findMany({
        where: { marketPda: { in: pdas } },
        select: { marketPda: true, status: true, outcome: true },
      });
      const byPda = new Map(markets.map((m) => [m.marketPda!, m]));
      for (const l of legsRaw) {
        const mk = l?.marketPda ? byPda.get(l.marketPda) : undefined;
        l.result =
          mk?.status === "RESOLVED" && mk.outcome
            ? (mk.outcome === "YES") === (Number(l.expected) === 1)
              ? "hit"
              : "miss"
            : null;
      }
    }

    return NextResponse.json({
      betPda: pda,
      idSeed: row.idSeed,
      owner: row.owner,
      stake: row.stake / 1e6,
      payout: row.payout / 1e6,
      legs: legsRaw,
      settled: row.settled,
      won: row.won,
      chain,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
