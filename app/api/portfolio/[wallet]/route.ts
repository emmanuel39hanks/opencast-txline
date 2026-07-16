import { NextResponse } from "next/server";
import { web3 } from "@coral-xyz/anchor";
import { getAllTournamentFixtures } from "@/lib/txline/client";
import { prisma } from "@/lib/db";
import { getServerProgram } from "@/lib/solana/server";
import { SOLANA } from "@/lib/txline/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROGRAM_ID = new web3.PublicKey(SOLANA.settlementProgramId);
const FEE_BPS = 200; // 2% platform fee

function positionPda(market: web3.PublicKey, user: web3.PublicKey) {
  return web3.PublicKey.findProgramAddressSync(
    [Buffer.from("position"), market.toBuffer(), user.toBuffer()],
    PROGRAM_ID,
  )[0];
}

/**
 * GET /api/portfolio/[wallet] → the wallet's on-chain positions across every
 * created market. For each persisted market we read the on-chain market +
 * the (market, wallet) position PDA, and compute cost basis, mark-to-pool
 * value, and any claimable pro-rata payout for settled markets.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ wallet: string }> },
) {
  try {
    const { wallet } = await params;
    const user = new web3.PublicKey(wallet);

    const [dbMarkets, fixtures] = await Promise.all([
      prisma.market.findMany({ where: { marketPda: { not: null } } }),
      getAllTournamentFixtures().catch(() => []),
    ]);
    const fxById = new Map(fixtures.map((f) => [f.FixtureId, f]));
    const program = getServerProgram();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const acct = (program.account as any).market;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const posAcct = (program.account as any).position;

    // Batch-read all markets + this wallet's position PDAs in a handful of
    // RPC calls — per-market fetches took minutes once the board grew to
    // 100+ markets and made the whole portfolio read as empty.
    const created = dbMarkets.filter((m) => m.marketPda);
    const marketKeys = created.map((m) => new web3.PublicKey(m.marketPda!));
    const posKeys = marketKeys.map((mk) => positionPda(mk, user));
    const fetchAll = async (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ns: any,
      keys: web3.PublicKey[],
    ) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const out: any[] = [];
      for (let i = 0; i < keys.length; i += 100) {
        try {
          out.push(...(await ns.fetchMultiple(keys.slice(i, i + 100))));
        } catch {
          out.push(...new Array(Math.min(100, keys.length - i)).fill(null));
        }
      }
      return out;
    };
    const [marketAccs, posAccs] = await Promise.all([
      fetchAll(acct, marketKeys),
      fetchAll(posAcct, posKeys),
    ]);

    const positions = created.map((dbm, i) => {
      const m = marketAccs[i];
      const p = posAccs[i];
      if (!m || !p) return null; // market missing or user never bet here
      {
        const yes = Number(p.yesAmount) / 1e6;
        const no = Number(p.noAmount) / 1e6;
        if (yes + no === 0) return null;

        const yesPool = Number(m.yesPool);
        const noPool = Number(m.noPool);
        const total = yesPool + noPool;
        const vault = total / 1e6;
        const priceYes = total > 0 ? yesPool / total : 0.5;
        const settled = Boolean(m.settled);
        const outcome = Number(m.outcome); // 1 YES · 2 NO
        const costBasis = yes + no;

        let currentValue = costBasis;
        let claimable = false;
        let claimableAmount = 0;
        let settledPayout: number | null = null;
        if (settled) {
          const winStake = outcome === 1 ? yes : no;
          const winPool = (outcome === 1 ? yesPool : noPool) / 1e6;
          const payout =
            winPool > 0 ? (winStake / winPool) * vault * (1 - FEE_BPS / 10_000) : 0;
          settledPayout = payout;
          // Once claimed, the payout lives in the wallet's cash — valuing it
          // here again would double-count it in "portfolio value".
          currentValue = p.claimed ? 0 : payout;
          claimable = !p.claimed && winStake > 0;
          claimableAmount = claimable ? payout : 0;
        }

        // Projected payout per side at current pools ("To win" column) —
        // pro-rata share of the whole vault, net of the 2% platform fee.
        const feeMult = 1 - FEE_BPS / 10_000;
        const toWinYes =
          yes > 0 && yesPool > 0 ? (yes / (yesPool / 1e6)) * vault * feeMult : 0;
        const toWinNo =
          no > 0 && noPool > 0 ? (no / (noPool / 1e6)) * vault * feeMult : 0;

        const fx = fxById.get(dbm.fixtureId);
        const endTime = fx
          ? new Date(fx.StartTime).toISOString()
          : new Date(dbm.createdAt).toISOString();
        const home = fx
          ? fx.Participant1IsHome
            ? fx.Participant1
            : fx.Participant2
          : undefined;
        const away = fx
          ? fx.Participant1IsHome
            ? fx.Participant2
            : fx.Participant1
          : undefined;

        return {
          marketId: dbm.fixtureId,
          marketPda: dbm.marketPda,
          market: {
            id: dbm.fixtureId,
            question: dbm.question,
            status: settled ? "RESOLVED" : "ACTIVE",
            priceYes,
            endTime,
            finalOutcome: settled ? (outcome === 1 ? "Yes" : "No") : undefined,
          },
          yesShares: yes,
          noShares: no,
          costBasis,
          currentValue,
          // Realized P&L for settled markets (claimed or not); mark-at-cost
          // (zero) while open.
          pnl: (settled ? (settledPayout ?? 0) : currentValue) - costBasis,
          settledPayout,
          claimed: Boolean(p.claimed),
          claimable,
          claimableAmount,
          toWinYes,
          toWinNo,
          // convenience for UI
          yesLabel: dbm.yesLabel,
          noLabel: dbm.noLabel,
          home,
          away,
          settled,
        };
      }
    });

    return NextResponse.json({ positions: positions.filter(Boolean) });
  } catch (e) {
    return NextResponse.json(
      { positions: [], error: (e as Error).message },
      { status: 200 },
    );
  }
}
