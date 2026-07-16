/**
 * Server-side Solana program client for the settle keeper. Uses the service
 * keypair (SOLANA_SERVICE_KEYPAIR) to sign settlement transactions. Never
 * import into a client component.
 */
import { AnchorProvider, Program, web3 } from "@coral-xyz/anchor";
import { SOLANA } from "@/lib/txline/config";
import idl from "./opencast_settlement.json";

export function serviceKeypair(): web3.Keypair {
  const raw = process.env.SOLANA_SERVICE_KEYPAIR;
  if (!raw) throw new Error("SOLANA_SERVICE_KEYPAIR not set");
  return web3.Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)));
}

export function getConnection(): web3.Connection {
  return new web3.Connection(SOLANA.rpcUrl, "confirmed");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getServerProgram(): Program<any> {
  const kp = serviceKeypair();
  // Plain wallet object — avoids importing anchor's Wallet class, which
  // doesn't bundle cleanly in the Next server runtime.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sign = (tx: any) => {
    if (tx.version !== undefined) tx.sign([kp]);
    else tx.partialSign(kp);
    return tx;
  };
  const wallet = {
    publicKey: kp.publicKey,
    payer: kp,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    signTransaction: async (tx: any) => sign(tx),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    signAllTransactions: async (txs: any[]) => txs.map(sign),
  };
  const provider = new AnchorProvider(
    getConnection(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    wallet as any,
    { commitment: "confirmed" },
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new Program(idl as any, provider);
}

export const TXORACLE_PROGRAM_ID = new web3.PublicKey(SOLANA.txoracleProgramId);
export const SETTLEMENT_PROGRAM_ID = new web3.PublicKey(SOLANA.settlementProgramId);
