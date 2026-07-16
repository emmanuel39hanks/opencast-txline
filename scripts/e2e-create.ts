/**
 * TEMP e2e: exercise the full create path the app uses —
 * /api/draft → create_market on-chain (draft's exact predicate) →
 * POST /api/markets → board slug → detail route. Run with:
 *   npx tsx scripts/e2e-create.ts "Will Argentina beat Spain?"
 */
import * as fs from "fs";
import * as path from "path";
import { BN, AnchorProvider, Program, Wallet, web3 } from "@coral-xyz/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  getOrCreateAssociatedTokenAccount,
} from "@solana/spl-token";
import idl from "../lib/solana/opencast_settlement.json";

for (const line of fs.readFileSync(".env", "utf8").split("\n")) {
  const m = /^([A-Z_]+)=(.*)$/.exec(line.trim());
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}
const USDC = new web3.PublicKey(process.env.NEXT_PUBLIC_USDC_MINT!);
const APP = "http://localhost:3010";
const QUESTION = process.argv[2] ?? "Will Argentina beat Spain?";

async function main() {
  // 1) Draft — same endpoint the create page calls.
  const draftRes = await fetch(`${APP}/api/draft`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question: QUESTION }),
  });
  const draft = (await draftRes.json()) as {
    ok?: boolean;
    unprovable?: boolean;
    fixtureId: number;
    statKeyA: number;
    statKeyB: number;
    threshold: number;
    comparison: number;
    question: string;
    yesLabel: string;
    noLabel: string;
  };
  if (!draft.ok) throw new Error("draft failed: " + JSON.stringify(draft).slice(0, 200));
  console.log("1) draft ok:", draft.question, "| fixture", draft.fixtureId,
    "| keys", draft.statKeyA, draft.statKeyB, "| thr", draft.threshold, "| cmp", draft.comparison);

  // 2) Create on-chain with the draft's exact predicate.
  const payer = web3.Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(path.join("_keys", "service-keypair.json"), "utf8"))),
  );
  const connection = new web3.Connection(
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com",
    "confirmed",
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const program = new Program(idl as any, new AnchorProvider(connection, new Wallet(payer), { commitment: "confirmed" }));
  const ata = await getOrCreateAssociatedTokenAccount(connection, payer, USDC, payer.publicKey);

  const seed = web3.Keypair.generate().publicKey;
  const [market] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("market"), seed.toBuffer()],
    program.programId,
  );
  const vault = getAssociatedTokenAddressSync(USDC, market, true);
  await program.methods
    .createMarket(seed, new BN(draft.fixtureId), draft.statKeyA, draft.statKeyB, draft.threshold, draft.comparison, new BN(30_000_000))
    .accounts({
      creator: payer.publicKey, market, usdcMint: USDC, vault, creatorUsdc: ata.address,
      tokenProgram: TOKEN_PROGRAM_ID, associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: web3.SystemProgram.programId,
    })
    .rpc();
  console.log("2) on-chain:", market.toBase58(), "(30 USDC seed)");

  // 3) Persist — same POST the create page makes.
  const persist = await fetch(`${APP}/api/markets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      marketPda: market.toBase58(),
      fixtureId: draft.fixtureId,
      statKeys: [draft.statKeyA, draft.statKeyB],
      strategy: { statKeyA: draft.statKeyA, statKeyB: draft.statKeyB, threshold: draft.threshold, comparison: draft.comparison },
      question: draft.question,
      yesLabel: draft.yesLabel,
      noLabel: draft.noLabel,
      creator: payer.publicKey.toBase58(),
    }),
  });
  console.log("3) persisted:", (await persist.json() as { ok?: boolean }).ok === true);

  // 4) Board + detail.
  const boardRes = await fetch(`${APP}/api/markets`);
  const board = (await boardRes.json()) as { markets: Array<{ slug?: string; marketPda?: string; question: string; matchState?: string }> };
  const entry = board.markets.find((m) => m.marketPda === market.toBase58());
  console.log("4) on board:", Boolean(entry), "| state:", entry?.matchState, "| slug:", entry?.slug);

  const detail = await fetch(`${APP}/markets/${entry?.slug}`);
  console.log("5) detail page:", detail.status);
}
main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
