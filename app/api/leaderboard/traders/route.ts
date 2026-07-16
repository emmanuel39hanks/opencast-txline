import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/leaderboard/traders → top wallets by recorded prediction volume. */
export async function GET() {
  try {
    const rows = await prisma.trade.groupBy({
      by: ["wallet"],
      _sum: { amount: true },
      _count: { _all: true },
      orderBy: { _sum: { amount: "desc" } },
      take: 10,
    });
    return NextResponse.json(
      rows.map((r) => ({
        id: r.wallet,
        walletAddr: r.wallet,
        displayName: "",
        avatarColor: "",
        bio: "",
        createdAt: "",
        marketsCreated: 0,
        totalVolumeUsdc: (r._sum.amount ?? 0) / 1e6,
        accuracy: 0,
        isAdmin: false,
      })),
    );
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
