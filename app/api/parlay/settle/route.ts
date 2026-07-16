import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { settleParlayByPda } from "@/lib/keeper";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/parlay/settle { betPda } — settle a parlay ticket on demand (same
 * trustless path the auto-settle cron uses: prove every leg against its own
 * anchored TxLINE proof, then finalize — won iff all legs held).
 */
export async function POST(req: Request) {
  try {
    const { betPda } = (await req.json()) as { betPda: string };
    if (!betPda) {
      return NextResponse.json({ error: "betPda required" }, { status: 400 });
    }
    const res = await settleParlayByPda(betPda);
    if (!res.settled) {
      return NextResponse.json(
        { error: `Not settleable yet: ${"pending" in res ? res.pending : "unknown"}` },
        { status: 409 },
      );
    }
    if (!("already" in res && res.already)) {
      await prisma.parlayBet
        .update({
          where: { betPda },
          data: { settled: true, won: "won" in res ? Boolean(res.won) : false },
        })
        .catch(() => null);
    }
    return NextResponse.json(res);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
