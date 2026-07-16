import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/leaderboard/creators → top wallets by markets created. */
export async function GET() {
  try {
    const rows = await prisma.market.groupBy({
      by: ["creator"],
      where: { marketPda: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { creator: "desc" } },
      take: 10,
    });
    const resolved = await prisma.market.groupBy({
      by: ["creator"],
      where: { marketPda: { not: null }, status: "RESOLVED" },
      _count: { _all: true },
    });
    const resolvedBy = new Map(resolved.map((r) => [r.creator, r._count._all]));
    return NextResponse.json(
      rows.map((r) => ({
        id: r.creator,
        walletAddr: r.creator,
        displayName: "",
        avatarColor: "",
        bio: "",
        createdAt: "",
        marketsCreated: r._count._all,
        totalVolumeUsdc: 0,
        // Share of their markets already settled (shown as the muted pill).
        accuracy: r._count._all
          ? (resolvedBy.get(r.creator) ?? 0) / r._count._all
          : 0,
        isAdmin: false,
      })),
    );
  } catch (e) {
    return NextResponse.json([], { status: 200 });
  }
}
