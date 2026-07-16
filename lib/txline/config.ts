/**
 * TxLINE + Solana configuration. Devnet defaults so the app runs without a
 * fully-populated .env during development. Secrets (TXLINE_API_TOKEN,
 * SOLANA_SERVICE_KEYPAIR) are server-only — never import this into a client
 * component that needs those fields.
 */

export const TXLINE = {
  /** Off-chain data API base, e.g. https://txline-dev.txodds.com/api */
  apiBaseUrl:
    process.env.TXLINE_API_BASE_URL ?? "https://txline-dev.txodds.com/api",
  /** Guest-session endpoint (returns a short-lived JWT). */
  jwtUrl:
    process.env.TXLINE_JWT_URL ??
    "https://txline-dev.txodds.com/auth/guest/start",
  /** World Cup competition id on the free tier. */
  competitionId: Number(process.env.TXLINE_COMPETITION_ID ?? 72),
  /** Long-lived API token minted via the free-tier subscribe+activate flow. */
  apiToken: process.env.TXLINE_API_TOKEN ?? "",
} as const;

export const SOLANA = {
  cluster: (process.env.NEXT_PUBLIC_SOLANA_CLUSTER ?? "devnet") as
    | "devnet"
    | "mainnet-beta",
  rpcUrl:
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com",
  /** TxLINE txoracle program (devnet) — CPI target for validate_stat_v2. */
  txoracleProgramId:
    process.env.NEXT_PUBLIC_TXORACLE_PROGRAM_ID ??
    "6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J",
  /** TxL subscription token mint (Token-2022). */
  txlineTokenMint:
    process.env.TXLINE_TOKEN_MINT ?? "4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG",
  /** Our settlement program id (filled after anchor deploy). */
  settlementProgramId: process.env.NEXT_PUBLIC_SETTLEMENT_PROGRAM_ID ?? "",
  /** USDC (or test SPL) mint used for escrow. */
  usdcMint: process.env.NEXT_PUBLIC_USDC_MINT ?? "",
} as const;
