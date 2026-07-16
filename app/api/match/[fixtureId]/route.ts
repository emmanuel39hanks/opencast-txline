import { NextResponse } from "next/server";
import { getAllTournamentFixtures, getScoreSnapshot } from "@/lib/txline/client";
import { parseMatch } from "@/lib/txline/match";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/match/[fixtureId] → structured live-match data (score, stats, clock,
 * event timeline) parsed from the TxLINE score snapshot. Powers the live match
 * card on the market detail page and the receipt.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ fixtureId: string }> },
) {
  const { fixtureId } = await params;
  const fid = Number(fixtureId);
  try {
    const [fixtures, records] = await Promise.all([
      getAllTournamentFixtures().catch(() => []),
      getScoreSnapshot(fid).catch(() => []),
    ]);
    const fx = fixtures.find((f) => f.FixtureId === fid);
    if (!records.length) {
      return NextResponse.json({ available: false });
    }
    const p1IsHome = fx?.Participant1IsHome ?? true;
    const home = fx
      ? p1IsHome
        ? fx.Participant1
        : fx.Participant2
      : "Home";
    const away = fx
      ? p1IsHome
        ? fx.Participant2
        : fx.Participant1
      : "Away";
    const match = parseMatch(fid, home, away, p1IsHome, records);
    return NextResponse.json({ available: true, match });
  } catch (e) {
    return NextResponse.json({ available: false, error: (e as Error).message });
  }
}
