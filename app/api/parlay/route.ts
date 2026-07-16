import { NextResponse } from "next/server";
import { web3 } from "@coral-xyz/anchor";
import { prisma } from "@/lib/db";
import { getServerProgram } from "@/lib/solana/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/parlay → persist a placed parlay ticket. */
export async function POST(req: Request) {
  try {
    const b = (await req.json()) as {
      betPda: string;
      idSeed: string;
      owner: string;
      stake: number; // USDC 6dp
      payout: number;
      legs: unknown[];
    };
    const existing = await prisma.parlayBet.findUnique({
      where: { betPda: b.betPda },
    });
    if (existing) return NextResponse.json({ ok: true, id: existing.id, existed: true });
    const row = await prisma.parlayBet.create({
      data: {
        betPda: b.betPda,
        idSeed: b.idSeed,
        owner: b.owner,
        stake: Math.round(b.stake),
        payout: Math.round(b.payout),
        legs: b.legs as object[],
      },
    });
    return NextResponse.json({ ok: true, id: row.id });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

/** GET /api/parlay?owner=… → the wallet's parlay tickets + live on-chain state. */
export async function GET(req: Request) {
  try {
    const owner = new URL(req.url).searchParams.get("owner");
    if (!owner) return NextResponse.json({ tickets: [] });
    const rows = await prisma.parlayBet.findMany({
      where: { owner },
      orderBy: { createdAt: "desc" },
    });
    const program = getServerProgram();
    const tickets = await Promise.all(
      rows.map(async (r) => {
        let chain: {
          evaluated: number;
          passed: number;
          settled: boolean;
          won: boolean;
          claimed: boolean;
        } | null = null;
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const c: any = await (program.account as any).parlayBet.fetch(
            new web3.PublicKey(r.betPda),
          );
          chain = {
            evaluated: Number(c.evaluated),
            passed: Number(c.passed),
            settled: Boolean(c.settled),
            won: Boolean(c.won),
            claimed: Boolean(c.claimed),
          };
        } catch {
          /* not found on-chain */
        }
        return {
          betPda: r.betPda,
          idSeed: r.idSeed,
          stake: r.stake / 1e6,
          payout: r.payout / 1e6,
          legs: r.legs,
          createdAt: r.createdAt,
          chain,
        };
      }),
    );
    return NextResponse.json({ tickets });
  } catch (e) {
    return NextResponse.json({ tickets: [], error: (e as Error).message });
  }
}
