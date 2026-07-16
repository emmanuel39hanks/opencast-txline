import { NextResponse } from "next/server";
import { web3 } from "@coral-xyz/anchor";
import {
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import { getConnection, serviceKeypair } from "@/lib/solana/server";
import { SOLANA } from "@/lib/txline/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Embedded wallets start with 0 SOL, so on-chain actions (create/predict/
// claim) can't pay tx fees + account rent. The faucet sponsors a small SOL
// top-up from the service keypair alongside the USDC mint — no airdrop rate
// limits, no gasless program changes needed for the demo.
const SOL_TOPUP = 0.05 * web3.LAMPORTS_PER_SOL;
const SOL_MIN = 0.02 * web3.LAMPORTS_PER_SOL;

/** POST /api/faucet { wallet } → top up devnet SOL (gas) + mint 1000 test USDC. */
export async function POST(req: Request) {
  try {
    const { wallet } = (await req.json()) as { wallet: string };
    if (!wallet) {
      return NextResponse.json({ error: "wallet required" }, { status: 400 });
    }
    const connection = getConnection();
    const authority = serviceKeypair(); // mint authority + SOL sponsor
    const mint = new web3.PublicKey(SOLANA.usdcMint);
    const owner = new web3.PublicKey(wallet);

    // 1) Top up SOL for gas + rent if the wallet is low.
    let sol = 0;
    const balance = await connection.getBalance(owner);
    if (balance < SOL_MIN) {
      const tx = new web3.Transaction().add(
        web3.SystemProgram.transfer({
          fromPubkey: authority.publicKey,
          toPubkey: owner,
          lamports: SOL_TOPUP,
        }),
      );
      await web3.sendAndConfirmTransaction(connection, tx, [authority], {
        commitment: "confirmed",
      });
      sol = SOL_TOPUP / web3.LAMPORTS_PER_SOL;
    }

    // 2) Mint 1000 test USDC.
    const ata = await getOrCreateAssociatedTokenAccount(
      connection,
      authority,
      mint,
      owner,
    );
    await mintTo(connection, authority, mint, ata.address, authority, 1_000_000_000);

    return NextResponse.json({
      ok: true,
      minted: 1000,
      sol,
      ata: ata.address.toBase58(),
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
