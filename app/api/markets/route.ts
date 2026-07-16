import { NextResponse } from "next/server";
import { web3 } from "@coral-xyz/anchor";
import { getAllTournamentFixtures } from "@/lib/txline/client";
import { fixtureToMarket, dbMarketToMarket } from "@/lib/txline/toMarket";
import { prisma } from "@/lib/db";
import { getServerProgram } from "@/lib/solana/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/markets → World Cup fixtures as markets, merged with any on-chain
 * markets created for them (live YES/NO pools + settlement status).
 */
export async function GET() {
  try {
    const [fixtures, db] = await Promise.all([
      getAllTournamentFixtures().catch(() => []),
      prisma.market.findMany().catch(() => []),
    ]);
    const fixtureIds = new Set(fixtures.map((f) => f.FixtureId));
    const program = getServerProgram();

    // Batch-read every created market account in one RPC sweep (chunks of
    // 100) instead of one fetch per market — the board now carries several
    // markets per fixture.
    const createdDb = db.filter((m) => m.marketPda);
    const onchainByPda = new Map<string, unknown>();
    for (let i = 0; i < createdDb.length; i += 100) {
      const chunk = createdDb.slice(i, i + 100);
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const accounts = await (program.account as any).market.fetchMultiple(
          chunk.map((m) => new web3.PublicKey(m.marketPda!)),
        );
        chunk.forEach((m, j) => onchainByPda.set(m.marketPda!, accounts[j]));
      } catch {
        // RPC hiccup — those markets render as uncreated this refresh.
      }
    }

    // Group created markets by fixture — a fixture can host many markets
    // (winner, props, jokes), and every one of them gets its own board entry.
    const createdByFixture = new Map<number, typeof createdDb>();
    for (const m of createdDb) {
      const arr = createdByFixture.get(m.fixtureId) ?? [];
      arr.push(m);
      createdByFixture.set(m.fixtureId, arr);
    }

    // 1. Fixture-backed entries: all created markets on the fixture, or a
    //    single "uncreated" template entry when nobody has made one yet.
    const fromFixtures = fixtures.flatMap((fx) => {
      const dbms = createdByFixture.get(fx.FixtureId);
      if (!dbms?.length) return [fixtureToMarket(fx, null, null)];
      return dbms.map((dbm) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        fixtureToMarket(fx, dbm as any, onchainByPda.get(dbm.marketPda!) as any),
      );
    });

    // 2. Markets whose fixture rotated out of the live feed (settled / past) —
    //    keep them visible so positions stay claimable.
    const orphans = createdDb.filter((m) => !fixtureIds.has(m.fixtureId));
    const fromDb = orphans.map((dbm) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      dbMarketToMarket(dbm as any, onchainByPda.get(dbm.marketPda!) as any),
    );

    return NextResponse.json({ markets: [...fromFixtures, ...fromDb] });
  } catch (e) {
    return NextResponse.json({ markets: [], error: (e as Error).message });
  }
}

/** POST /api/markets → persist a market created on-chain. */
export async function POST(req: Request) {
  try {
    const b = (await req.json()) as {
      marketPda: string;
      fixtureId: number;
      statKeys: number[];
      strategy?: unknown;
      question: string;
      yesLabel: string;
      noLabel: string;
      creator: string;
    };
    const existing = await prisma.market.findFirst({
      where: { marketPda: b.marketPda },
    });
    if (existing) return NextResponse.json({ ok: true, id: existing.id, existed: true });

    const m = await prisma.market.create({
      data: {
        marketPda: b.marketPda,
        fixtureId: b.fixtureId,
        statKeys: b.statKeys,
        strategy: (b.strategy ?? {}) as object,
        question: b.question,
        yesLabel: b.yesLabel,
        noLabel: b.noLabel,
        creator: b.creator,
        category: "sports",
      },
    });
    return NextResponse.json({ ok: true, id: m.id });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
