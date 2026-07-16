/** Create one market (+ a YES stake) and print its PDA, for keeper testing. */
import * as fs from "fs";
import * as path from "path";
import { BN, AnchorProvider, Program, Wallet, web3 } from "@coral-xyz/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import idl from "../lib/solana/opencast_settlement.json";

for (const line of fs.readFileSync(".env", "utf8").split("\n")) {
  const m = /^([A-Z_]+)=(.*)$/.exec(line.trim());
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}
const USDC = new web3.PublicKey(process.env.NEXT_PUBLIC_USDC_MINT!);
const FIXTURE = Number(process.argv[2] ?? 18237038);

async function main() {
  const payer = web3.Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(path.join("_keys", "service-keypair.json"), "utf8"))));
  const connection = new web3.Connection("https://api.devnet.solana.com", "confirmed");
  const program = new Program(idl as any, new AnchorProvider(connection, new Wallet(payer), { commitment: "confirmed" }));

  const ata = await getOrCreateAssociatedTokenAccount(connection, payer, USDC, payer.publicKey);
  await mintTo(connection, payer, USDC, ata.address, payer, 200_000_000);

  const seed = web3.Keypair.generate().publicKey;
  const [market] = web3.PublicKey.findProgramAddressSync([Buffer.from("market"), seed.toBuffer()], program.programId);
  const vault = getAssociatedTokenAddressSync(USDC, market, true);
  await program.methods.createMarket(seed, new BN(FIXTURE), 1, 2, 0, 0, new BN(50_000_000))
    .accounts({ creator: payer.publicKey, market, usdcMint: USDC, vault, creatorUsdc: ata.address,
      tokenProgram: TOKEN_PROGRAM_ID, associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID, systemProgram: web3.SystemProgram.programId })
    .rpc();
  const [position] = web3.PublicKey.findProgramAddressSync([Buffer.from("position"), market.toBuffer(), payer.publicKey.toBuffer()], program.programId);
  await program.methods.placePrediction(2, new BN(30_000_000)).accounts({ // NO 30 USDC
    user: payer.publicKey, market, position, vault, userUsdc: ata.address,
    tokenProgram: TOKEN_PROGRAM_ID, systemProgram: web3.SystemProgram.programId }).rpc();

  console.log("MARKET_PDA=" + market.toBase58());
}
main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
