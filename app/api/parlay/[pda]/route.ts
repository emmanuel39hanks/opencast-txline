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

    return NextResponse.json({
      betPda: pda,
      idSeed: row.idSeed,
      owner: row.owner,
      stake: row.stake / 1e6,
      payout: row.payout / 1e6,
      legs: row.legs,
      settled: row.settled,
      won: row.won,
      chain,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
