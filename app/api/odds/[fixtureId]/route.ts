import { NextResponse } from "next/server";
import { getAllTournamentFixtures, getOddsSnapshot } from "@/lib/txline/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface TxOddsRecord {
  FixtureId: number;
  MessageId: string;
  Ts: number;
  Bookmaker: string;
  SuperOddsType: string;
  MarketPeriod: string | null;
  InRunning: boolean;
  PriceNames: string[];
  Prices: number[];
  Pct: string[];
}

/**
 * GET /api/odds/[fixtureId] → TxLINE's own match line (1X2 implied
 * probabilities from the TxODDS feed), mapped to home/draw/away. This is the
 * second TxLINE feed we consume — scores settle markets, odds give traders a
 * professional reference line next to the pool price.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ fixtureId: string }> },
) {
  const { fixtureId } = await params;
  const fid = Number(fixtureId);
  try {
    const [odds, fixtures] = await Promise.all([
      getOddsSnapshot(fid) as Promise<TxOddsRecord[]>,
      getAllTournamentFixtures().catch(() => []),
    ]);
    const fx = fixtures.find((f) => f.FixtureId === fid);
    const oneXTwo = (odds ?? []).filter(
      (o) => o.SuperOddsType === "1X2_PARTICIPANT_RESULT",
    );
    // Full-match line preferred; latest record wins.
    const rec =
      oneXTwo.filter((o) => !o.MarketPeriod).sort((a, b) => b.Ts - a.Ts)[0] ??
      oneXTwo.sort((a, b) => b.Ts - a.Ts)[0];
    if (!rec) return NextResponse.json({ available: false });

    const idx = (name: string) => rec.PriceNames.indexOf(name);
    const pct = (i: number) => (i >= 0 ? Number(rec.Pct[i]) : null);
    const p1 = pct(idx("part1"));
    const p2 = pct(idx("part2"));
    const draw = pct(idx("draw"));
    const p1IsHome = fx?.Participant1IsHome ?? true;

    return NextResponse.json({
      available: true,
      fixtureId: fid,
      bookmaker: rec.Bookmaker,
      ts: rec.Ts,
      inRunning: rec.InRunning,
      period: rec.MarketPeriod, // null = full match
      home: fx ? (p1IsHome ? fx.Participant1 : fx.Participant2) : "Home",
      away: fx ? (p1IsHome ? fx.Participant2 : fx.Participant1) : "Away",
      line: {
        home: p1IsHome ? p1 : p2,
        draw,
        away: p1IsHome ? p2 : p1,
      },
    });
  } catch (e) {
    return NextResponse.json({ available: false, error: (e as Error).message });
  }
}
