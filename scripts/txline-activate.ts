/**
 * One-time TxLINE free-tier onboarding for the World Cup tier (devnet).
 *
 *   npx tsx scripts/txline-activate.ts
 *
 * Creates/loads a devnet service keypair (_keys/service-keypair.json), airdrops
 * SOL, subscribes to the free tier on the txoracle program, and activates a
 * long-lived API token. Prints the values to paste into .env:
 *   TXLINE_API_TOKEN=...
 *   SOLANA_SERVICE_KEYPAIR=[..bytes..]
 *
 * Ported from the TxLINE reference (examples/devnet/common/users.ts).
 */
import * as fs from "fs";
import * as path from "path";
import {
  AnchorProvider,
  Program,
  Wallet,
  web3,
} from "@coral-xyz/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import nacl from "tweetnacl";
// Devnet IDL (program 6pW…). Address baked into the IDL.
import idl from "../reference/txline/txoracle.idl.json";

const RPC = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
const API_BASE = process.env.TXLINE_API_BASE_URL ?? "https://txline-dev.txodds.com/api";
const JWT_URL = process.env.TXLINE_JWT_URL ?? "https://txline-dev.txodds.com/auth/guest/start";
const TOKEN_MINT = new web3.PublicKey(
  process.env.TXLINE_TOKEN_MINT ?? "4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG",
);
const SERVICE_LEVEL_ID = 1;
const WEEKS = 4;
const LEAGUES: number[] = []; // free World Cup tier

const KEY_PATH = path.join(process.cwd(), "_keys", "service-keypair.json");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function loadOrCreateKeypair(): web3.Keypair {
  if (fs.existsSync(KEY_PATH)) {
    const bytes = Uint8Array.from(JSON.parse(fs.readFileSync(KEY_PATH, "utf8")));
    console.log("• Loaded existing service keypair");
    return web3.Keypair.fromSecretKey(bytes);
  }
  const kp = web3.Keypair.generate();
  fs.mkdirSync(path.dirname(KEY_PATH), { recursive: true });
  fs.writeFileSync(KEY_PATH, JSON.stringify(Array.from(kp.secretKey)));
  console.log("• Generated new service keypair →", KEY_PATH);
  return kp;
}

async function ensureSol(conn: web3.Connection, pubkey: web3.PublicKey) {
  const bal = await conn.getBalance(pubkey);
  console.log(`• Balance: ${(bal / web3.LAMPORTS_PER_SOL).toFixed(3)} SOL`);
  // ATA + subscribe need only ~0.05 SOL; skip airdrop once minimally funded.
  if (bal >= 0.05 * web3.LAMPORTS_PER_SOL) return;
  for (let i = 0; i < 3; i++) {
    try {
      console.log("• Requesting devnet airdrop (1 SOL)…");
      const sig = await conn.requestAirdrop(pubkey, web3.LAMPORTS_PER_SOL);
      await conn.confirmTransaction(sig, "confirmed");
      console.log("  ✓ airdrop confirmed");
      return;
    } catch (e) {
      console.log(`  airdrop attempt ${i + 1} failed (${(e as Error).message}); retrying…`);
      await sleep(3000);
    }
  }
  console.log(
    "  ⚠ airdrop failed — fund the address manually via https://faucet.solana.com then re-run.",
  );
}

async function main() {
  const keypair = loadOrCreateKeypair();
  console.log("• Service wallet:", keypair.publicKey.toBase58());

  const connection = new web3.Connection(RPC, "confirmed");
  await ensureSol(connection, keypair.publicKey);

  const provider = new AnchorProvider(connection, new Wallet(keypair), {
    commitment: "confirmed",
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const program = new Program(idl as any, provider);
  const programId = program.programId;
  console.log("• txoracle program:", programId.toBase58());

  // PDAs (from reference).
  const [pricingMatrixPda] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("pricing_matrix")],
    programId,
  );
  const [tokenTreasuryPda] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("token_treasury_v2")],
    programId,
  );
  const tokenTreasuryVault = getAssociatedTokenAddressSync(
    TOKEN_MINT,
    tokenTreasuryPda,
    true,
    TOKEN_2022_PROGRAM_ID,
  );
  const userTokenAccount = getAssociatedTokenAddressSync(
    TOKEN_MINT,
    keypair.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID,
  );

  // Create the Token-2022 ATA for the TxL mint if it doesn't exist.
  const ataInfo = await connection.getAccountInfo(userTokenAccount);
  if (!ataInfo) {
    console.log("• Creating Token-2022 ATA for TxL mint…");
    const tx = new web3.Transaction().add(
      createAssociatedTokenAccountInstruction(
        keypair.publicKey,
        userTokenAccount,
        keypair.publicKey,
        TOKEN_MINT,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      ),
    );
    await web3.sendAndConfirmTransaction(connection, tx, [keypair], {
      commitment: "confirmed",
    });
    console.log("  ✓ ATA created");
    await sleep(2000);
  }

  // Guest JWT.
  const jwtRes = await fetch(JWT_URL, { method: "POST" });
  const { token: jwt } = (await jwtRes.json()) as { token: string };
  console.log("• Guest JWT acquired");

  // Subscribe (free tier).
  console.log(`• Subscribing on-chain: level ${SERVICE_LEVEL_ID}, ${WEEKS} weeks…`);
  const txSig = await program.methods
    .subscribe(SERVICE_LEVEL_ID, WEEKS)
    .accounts({
      user: keypair.publicKey,
      pricingMatrix: pricingMatrixPda,
      tokenMint: TOKEN_MINT,
      userTokenAccount,
      tokenTreasuryVault,
      tokenTreasuryPda,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: web3.SystemProgram.programId,
    })
    .rpc({ commitment: "confirmed" });
  console.log("  ✓ subscribe tx:", txSig);

  // Activate → API token.
  const message = `${txSig}:${LEAGUES.join(",")}:${jwt}`;
  const signature = Buffer.from(
    nacl.sign.detached(new TextEncoder().encode(message), keypair.secretKey),
  ).toString("base64");

  const actRes = await fetch(`${API_BASE}/token/activate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({ txSig, walletSignature: signature, leagues: LEAGUES }),
  });
  if (!actRes.ok) {
    throw new Error(`activate failed: ${actRes.status} ${await actRes.text()}`);
  }
  // /token/activate returns the token as a raw string (not JSON).
  const rawActivation = (await actRes.text()).trim();
  let apiToken: string;
  try {
    const parsed = JSON.parse(rawActivation);
    apiToken = parsed.token ?? parsed;
  } catch {
    apiToken = rawActivation;
  }

  console.log("\n══════════════════════════════════════════════════════════");
  console.log("✓ Activated. Paste into .env:\n");
  console.log(`TXLINE_API_TOKEN=${apiToken}`);
  console.log(`SOLANA_SERVICE_KEYPAIR=${JSON.stringify(Array.from(keypair.secretKey))}`);
  console.log("══════════════════════════════════════════════════════════\n");

  // Quick smoke test: pull a couple of World Cup fixtures.
  const wc = await fetch(`${API_BASE}/fixtures/snapshot?competitionId=72`, {
    headers: { Authorization: `Bearer ${jwt}`, "X-Api-Token": apiToken },
  });
  console.log("• WC fixtures probe →", wc.status);
  if (wc.ok) {
    const arr = (await wc.json()) as unknown[];
    console.log(`  got ${arr.length} fixtures. sample:`, JSON.stringify(arr[0] ?? null).slice(0, 300));
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error("\n✗ activation failed:", err);
    process.exit(1);
  },
);
