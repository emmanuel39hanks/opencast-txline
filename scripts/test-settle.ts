/**
 * End-to-end on-chain test of the trustless settlement loop against a REAL
 * TxLINE proof (devnet):
 *   mint test USDC → create_market → place_prediction → fetch live proof →
 *   settle_market (CPI validate_stat_v2) → claim.
 *
 *   npx tsx scripts/test-settle.ts
 */
import * as fs from "fs";
import * as path from "path";
import {
  AnchorProvider,
  BN,
  Program,
  Wallet,
  web3,
} from "@coral-xyz/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  getOrCreateAssociatedTokenAccount,
  getAccount,
  mintTo,
} from "@solana/spl-token";
import idl from "../lib/solana/opencast_settlement.json";

// ── tiny .env loader (tsx doesn't auto-load) ────────────────────────────────
for (const line of fs.readFileSync(path.join(process.cwd(), ".env"), "utf8").split("\n")) {
  const m = /^([A-Z_]+)=(.*)$/.exec(line.trim());
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const RPC = "https://api.devnet.solana.com";
const API = process.env.TXLINE_API_BASE_URL!;
const JWT_URL = process.env.TXLINE_JWT_URL!;
const API_TOKEN = process.env.TXLINE_API_TOKEN!;
const TXORACLE = new web3.PublicKey(process.env.NEXT_PUBLIC_TXORACLE_PROGRAM_ID!);
const USDC_MINT = new web3.PublicKey(process.env.NEXT_PUBLIC_USDC_MINT!);
const FIXTURE_ID = 18237038; // France vs Spain (live sim)
const STAT_A = 1; // home goals
const STAT_B = 2; // away goals

const kp = (p: string) =>
  web3.Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(p, "utf8"))));

let cachedJwt: string | null = null;
async function jwt() {
  if (!cachedJwt) cachedJwt = (await (await fetch(JWT_URL, { method: "POST" })).json()).token;
  return cachedJwt;
}
async function tget(pathq: string) {
  return fetch(`${API}${pathq}`, {
    headers: { Authorization: `Bearer ${await jwt()}`, "X-Api-Token": API_TOKEN },
  });
}

const node = (n: any) => ({ hash: n.hash, isRightSibling: !!(n.isRightSibling ?? n.is_right_sibling) });

async function main() {
  const payer = kp(path.join(process.cwd(), "_keys/service-keypair.json"));
  const connection = new web3.Connection(RPC, "confirmed");
  const provider = new AnchorProvider(connection, new Wallet(payer), { commitment: "confirmed" });
  const program = new Program(idl as any, provider);
  console.log("• program:", program.programId.toBase58());
  console.log("• payer:", payer.publicKey.toBase58());

  // 1. Mint test USDC to payer (acts as creator + trader).
  const payerAta = await getOrCreateAssociatedTokenAccount(connection, payer, USDC_MINT, payer.publicKey);
  await mintTo(connection, payer, USDC_MINT, payerAta.address, payer, 1_000_000_000); // 1000 USDC
  console.log("• minted 1000 test USDC");

  // 2. create_market
  const seed = web3.Keypair.generate().publicKey;
  const [market] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("market"), seed.toBuffer()], program.programId);
  const vault = getAssociatedTokenAddressSync(USDC_MINT, market, true);
  await program.methods
    .createMarket(seed, new BN(FIXTURE_ID), STAT_A, STAT_B, 0, 0, new BN(100_000_000)) // seed 100 USDC
    .accounts({
      creator: payer.publicKey,
      market,
      usdcMint: USDC_MINT,
      vault,
      creatorUsdc: payerAta.address,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: web3.SystemProgram.programId,
    })
    .rpc();
  console.log("• created market:", market.toBase58());

  // 3. place_prediction YES 50 USDC
  const [position] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("position"), market.toBuffer(), payer.publicKey.toBuffer()], program.programId);
  await program.methods.placePrediction(1, new BN(50_000_000)).accounts({
    user: payer.publicKey, market, position, vault, userUsdc: payerAta.address,
    tokenProgram: TOKEN_PROGRAM_ID, systemProgram: web3.SystemProgram.programId,
  }).rpc();
  console.log("• placed 50 USDC on YES");

  // 4. fetch a live, anchored proof — walk back from the latest seq until one
  //    validates (very recent records aren't anchored on-chain yet).
  const snap = await (await tget(`/scores/snapshot/${FIXTURE_ID}`)).json();
  let p: any = null;
  let usedSeq = 0;
  for (let i = snap.length - 1; i >= 0 && i >= snap.length - 60; i--) {
    const s = snap[i].Seq;
    const r = await tget(`/scores/stat-validation?fixtureId=${FIXTURE_ID}&seq=${s}&statKeys=${STAT_A},${STAT_B}`);
    if (r.ok) { p = await r.json(); usedSeq = s; break; }
  }
  if (!p) throw new Error("no anchored proof found in recent records");
  console.log("• proof @ seq", usedSeq, "| stats:", JSON.stringify(p.statsToProve));

  // txoracle keys the daily-scores root + seed check on minTimestamp.
  const targetTs = p.summary.updateStats.minTimestamp;
  const payload = {
    ts: new BN(targetTs),
    fixtureSummary: {
      fixtureId: new BN(p.summary.fixtureId),
      updateStats: {
        updateCount: p.summary.updateStats.updateCount,
        minTimestamp: new BN(p.summary.updateStats.minTimestamp),
        maxTimestamp: new BN(p.summary.updateStats.maxTimestamp),
      },
      eventsSubTreeRoot: p.summary.eventStatsSubTreeRoot,
    },
    fixtureProof: p.subTreeProof.map(node),
    mainTreeProof: p.mainTreeProof.map(node),
    eventStatRoot: p.eventStatRoot,
    stats: p.statsToProve.map((s: any, i: number) => ({
      stat: { key: s.key, value: s.value, period: s.period },
      statProof: p.statProofs[i].map(node),
    })),
  };

  // daily_scores_roots PDA for the proof's epoch day (u16 LE), from minTimestamp.
  const epochDay = Math.floor(targetTs / 86_400_000);
  const edBuf = Buffer.alloc(2);
  edBuf.writeUInt16LE(epochDay);
  const [dailyScores] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("daily_scores_roots"), edBuf], TXORACLE);
  console.log("• epochDay", epochDay, "| dailyScores PDA:", dailyScores.toBase58());

  // 5. settle_market (CPI)
  const cu = web3.ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 });
  await program.methods.settleMarket(payload)
    .accounts({ keeper: payer.publicKey, market, dailyScoresMerkleRoots: dailyScores, txoracleProgram: TXORACLE })
    .preInstructions([cu])
    .rpc();
  const m: any = await program.account.market.fetch(market);
  console.log("• SETTLED. outcome:", m.outcome === 1 ? "YES" : "NO", "(1=YES/2=NO)");

  // 6. claim (if YES won, payer wins)
  const before = Number((await getAccount(connection, payerAta.address)).amount);
  try {
    await program.methods.claim().accounts({
      user: payer.publicKey, market, position, vault, userUsdc: payerAta.address,
      tokenProgram: TOKEN_PROGRAM_ID,
    }).rpc();
    const after = Number((await getAccount(connection, payerAta.address)).amount);
    console.log("• CLAIMED. USDC delta:", (after - before) / 1e6);
  } catch (e) {
    console.log("• claim skipped:", (e as Error).message.slice(0, 80));
  }
  console.log("\n✓ end-to-end loop complete");
}

main().then(() => process.exit(0), (e) => { console.error("\n✗", e); process.exit(1); });
