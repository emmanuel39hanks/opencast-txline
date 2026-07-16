import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/trades — record a confirmed prediction (client-reported after the
 * on-chain transaction lands). Powers the market activity feed and the
 * traders leaderboard; the source of truth for money stays on-chain.
 */
export async function POST(req: Request) {
  try {
    const b = (await req.json()) as {
      marketPda: string;
      wallet: string;
      side: number;
      amountUsdc: number;
      txSig?: string;
    };
    if (!b.marketPda || !b.wallet || ![1, 2].includes(Number(b.side))) {
      return NextResponse.json({ error: "bad payload" }, { status: 400 });
    }
    const amount = Math.round(Number(b.amountUsdc) * 1e6);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1e12) {
      return NextResponse.json({ error: "bad amount" }, { status: 400 });
    }
    await prisma.trade.create({
      data: {
        marketPda: b.marketPda,
        wallet: b.wallet,
        side: Number(b.side),
        amount,
        txSig: b.txSig ?? null,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

/**
 * GET /api/trades?market=<pda>       → last 20 trades on a market
 * GET /api/trades?top=traders        → top 10 wallets by total volume
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const market = url.searchParams.get("market");
    if (market) {
      const rows = await prisma.trade.findMany({
        where: { marketPda: market },
        orderBy: { ts: "desc" },
        take: 20,
      });
      return NextResponse.json({
        trades: rows.map((r) => ({
          wallet: r.wallet,
          side: r.side,
          amountUsdc: r.amount / 1e6,
          ts: r.ts,
        })),
      });
    }
    if (url.searchParams.get("top") === "traders") {
      const rows = await prisma.trade.groupBy({
        by: ["wallet"],
        _sum: { amount: true },
        _count: { _all: true },
        orderBy: { _sum: { amount: "desc" } },
        take: 10,
      });
      return NextResponse.json({
        traders: rows.map((r) => ({
          wallet: r.wallet,
          volumeUsdc: (r._sum.amount ?? 0) / 1e6,
          trades: r._count._all,
        })),
      });
    }
    return NextResponse.json({ trades: [] });
  } catch (e) {
    return NextResponse.json({ trades: [], error: (e as Error).message });
  }
}
