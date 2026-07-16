import { NextResponse } from "next/server";
import { web3 } from "@coral-xyz/anchor";
import { prisma } from "@/lib/db";
import { getServerProgram } from "@/lib/solana/server";
import {
  isFixtureFinal,
  settleMarketByPda,
  settleParlayByPda,
} from "@/lib/keeper";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * GET /api/keeper — the auto-settlement sweep (run by cron, callable by anyone;
 * settlement itself is trustless so triggering it is permissionless).
 *
 * 1. Every created market whose fixture is FINISHED on TxLINE → settle_market.
 * 2. Every open parlay ticket whose fixtures are all FINISHED → prove legs +
 *    finalize.
 *
 * This is what makes OpenCast markets "auto-settled": no admin, no button —
 * the moment TxLINE anchors the final score, the proof is relayed and funds
 * unlock.
 */
/** Max settlement transactions per sweep — the cron re-runs, so a backlog
 *  drains across runs instead of blowing the serverless time budget. */
const MAX_SETTLES_PER_RUN = 10;

export async function GET(req: Request) {
  // Optional hardening: when CRON_SECRET is set, only the cron may trigger
  // the sweep. Unset (default) keeps triggering permissionless — settlement
  // itself is trustless either way.
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const program = getServerProgram();
  let settles = 0;
  const out: {
    markets: Record<string, unknown>[];
    parlays: Record<string, unknown>[];
  } = { markets: [], parlays: [] };
  const finalCache = new Map<number, boolean>();
  const fixtureFinal = async (id: number) => {
    if (!finalCache.has(id)) finalCache.set(id, await isFixtureFinal(id));
    return finalCache.get(id)!;
  };

  // ── 1. Markets ────────────────────────────────────────────────────────────
  // Pool-price snapshots ride along with the sweep (no extra RPC): every
  // active market we touch gets a PricePoint, so odds charts plot real
  // history instead of a synthetic walk.
  const pricePoints: { marketPda: string; priceYes: number }[] = [];
  try {
    const dbMarkets = await prisma.market.findMany({
      where: { marketPda: { not: null }, status: "ACTIVE" },
    });
    for (const dbm of dbMarkets) {
      const pda = dbm.marketPda!;
      try {
        // Skip if already settled on-chain (sync DB while we're here).
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const m: any = await (program.account as any).market.fetch(
          new web3.PublicKey(pda),
        );
        {
          const yes = Number(m.yesPool);
          const total = yes + Number(m.noPool);
          if (total > 0 && !m.settled) {
            pricePoints.push({ marketPda: pda, priceYes: yes / total });
          }
        }
        if (m.settled) {
          await prisma.market.update({
            where: { id: dbm.id },
            data: {
              status: "RESOLVED",
              outcome: Number(m.outcome) === 1 ? "YES" : "NO",
            },
          });
          out.markets.push({ pda, synced: true });
          continue;
        }
        if (!(await fixtureFinal(dbm.fixtureId))) {
          out.markets.push({ pda, waiting: "fixture not final" });
          continue;
        }
        if (settles >= MAX_SETTLES_PER_RUN) {
          out.markets.push({ pda, deferred: "settle budget reached" });
          continue;
        }
        settles++;
        const res = await settleMarketByPda(pda);
        if (res.settled && !("already" in res && res.already)) {
          await prisma.market.update({
            where: { id: dbm.id },
            data: {
              status: "RESOLVED",
              outcome: res.outcome === 1 ? "YES" : "NO",
              settleTxSig: "txSig" in res ? (res.txSig as string) : null,
              // Persist the proof so the receipt survives TxLINE access ending.
              proofJson: "proof" in res ? (res.proof as object) : undefined,
            },
          });
        }
        out.markets.push({ pda, ...res });
      } catch (e) {
        out.markets.push({ pda, error: (e as Error).message.slice(0, 120) });
      }
    }
  } catch (e) {
    out.markets.push({ error: (e as Error).message.slice(0, 120) });
  }

  if (pricePoints.length) {
    await prisma.pricePoint.createMany({ data: pricePoints }).catch(() => {});
  }

  // ── 2. Parlay tickets ─────────────────────────────────────────────────────
  try {
    const open = await prisma.parlayBet.findMany({ where: { settled: false } });
    for (const t of open) {
      try {
        // Already settled on-chain? Sync the DB and move on.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const chain: any = await (program.account as any).parlayBet
          .fetch(new web3.PublicKey(t.betPda))
          .catch(() => null);
        if (chain?.settled) {
          await prisma.parlayBet.update({
            where: { betPda: t.betPda },
            data: { settled: true, won: Boolean(chain.won) },
          });
          out.parlays.push({ betPda: t.betPda, synced: true });
          continue;
        }
        const legs = (t.legs as { fixtureId: number }[]) ?? [];
        const allFinal = (
          await Promise.all(legs.map((l) => fixtureFinal(l.fixtureId)))
        ).every(Boolean);
        if (!allFinal) {
          out.parlays.push({ betPda: t.betPda, waiting: "legs not final" });
          continue;
        }
        if (settles >= MAX_SETTLES_PER_RUN) {
          out.parlays.push({ betPda: t.betPda, deferred: "settle budget reached" });
          continue;
        }
        settles++;
        const res = await settleParlayByPda(t.betPda);
        if (res.settled) {
          await prisma.parlayBet.update({
            where: { betPda: t.betPda },
            data: { settled: true, won: "won" in res ? Boolean(res.won) : false },
          });
        }
        out.parlays.push({ betPda: t.betPda, ...res });
      } catch (e) {
        out.parlays.push({
          betPda: t.betPda,
          error: (e as Error).message.slice(0, 120),
        });
      }
    }
  } catch (e) {
    out.parlays.push({ error: (e as Error).message.slice(0, 120) });
  }

  return NextResponse.json(out);
}
