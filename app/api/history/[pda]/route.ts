import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/history/[pda] → real pool-price history (keeper snapshots every
 * sweep). The odds chart uses this when enough points exist.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ pda: string }> },
) {
  try {
    const { pda } = await params;
    const rows = await prisma.pricePoint.findMany({
      where: { marketPda: pda },
      orderBy: { ts: "asc" },
      take: 500,
    });
    return NextResponse.json({
      points: rows.map((r) => ({ t: r.ts.getTime(), yes: r.priceYes })),
    });
  } catch (e) {
    return NextResponse.json({ points: [], error: (e as Error).message });
  }
}
