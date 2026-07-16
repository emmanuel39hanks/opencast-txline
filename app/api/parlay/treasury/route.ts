import { NextResponse } from "next/server";
import { web3 } from "@coral-xyz/anchor";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  mintTo,
} from "@solana/spl-token";
import {
  getServerProgram,
  serviceKeypair,
  getConnection,
} from "@/lib/solana/server";
import { treasuryPda } from "@/lib/keeper";
import { SOLANA } from "@/lib/txline/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const USDC = new web3.PublicKey(SOLANA.usdcMint);
const TARGET_BANKROLL = 100_000_000_000; // 100k test USDC

/**
 * GET /api/parlay/treasury — the parlay bankroll's live status: vault balance,
 * reserved liabilities (sum of outstanding payouts), and free capacity. Every
 * ticket's payout is reserved on-chain at place-time, so the vault can never
 * promise more than it holds.
 */
export async function GET() {
  try {
    const program = getServerProgram();
    const treasury = treasuryPda();
    const vault = getAssociatedTokenAddressSync(USDC, treasury, true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let t: any = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      t = await (program.account as any).treasury.fetch(treasury);
    } catch {
      return NextResponse.json({ initialized: false, treasury: treasury.toBase58() });
    }
    const bal = await getConnection()
      .getTokenAccountBalance(vault)
      .catch(() => null);
    const vaultUsdc = bal ? Number(bal.value.amount) / 1e6 : 0;
    const reserved = Number(t.reserved) / 1e6;
    return NextResponse.json({
      initialized: true,
      treasury: treasury.toBase58(),
      vault: vault.toBase58(),
      vaultUsdc,
      reservedUsdc: reserved,
      freeUsdc: Math.max(0, vaultUsdc - reserved),
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

/**
 * POST /api/parlay/treasury — devnet ops: init the treasury if missing and top
 * the bankroll up to 100k test USDC (service keypair is the mint authority).
 */
export async function POST() {
  try {
    const program = getServerProgram();
    const kp = serviceKeypair();
    const conn = getConnection();
    const treasury = treasuryPda();
    const vault = getAssociatedTokenAddressSync(USDC, treasury, true);

    let initSig = "exists";
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (program.account as any).treasury.fetch(treasury);
    } catch {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      initSig = await (program.methods as any)
        .initTreasury()
        .accounts({
          payer: kp.publicKey,
          treasury,
          usdcMint: USDC,
          vault,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: web3.SystemProgram.programId,
        })
        .rpc();
    }

    const bal = await conn.getTokenAccountBalance(vault).catch(() => null);
    const have = bal ? Number(bal.value.amount) : 0;
    let fundSig = "topped-up";
    if (have < TARGET_BANKROLL) {
      fundSig = await mintTo(conn, kp, USDC, vault, kp, TARGET_BANKROLL - have);
    }
    return NextResponse.json({
      ok: true,
      treasury: treasury.toBase58(),
      initSig,
      fundSig,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
