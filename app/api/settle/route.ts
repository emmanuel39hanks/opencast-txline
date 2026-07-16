import { NextResponse } from "next/server";
import { settleMarketByPda } from "@/lib/keeper";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/settle { marketPda } — settle a market on demand (same trustless
 * path the auto-settle cron uses: relay an anchored TxLINE proof, the program
 * CPIs validate_stat_v2 and stores the outcome).
 */
export async function POST(req: Request) {
  try {
    const { marketPda } = (await req.json()) as { marketPda: string };
    if (!marketPda) {
      return NextResponse.json({ error: "marketPda required" }, { status: 400 });
    }
    const res = await settleMarketByPda(marketPda);
    if (!res.settled) {
      return NextResponse.json(
        { error: "No anchored TxLINE proof available for this fixture yet." },
        { status: 409 },
      );
    }
    // Sync the DB row + persist the proof so the receipt outlives the API.
    await prisma.market
      .updateMany({
        where: { marketPda },
        data: {
          status: "RESOLVED",
          outcome: res.outcome === 1 ? "YES" : "NO",
          settleTxSig: "txSig" in res ? (res.txSig as string) : undefined,
          proofJson: "proof" in res ? (res.proof as object) : undefined,
        },
      })
      .catch(() => {});
    return NextResponse.json(res);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
