"use client";

/**
 * Client-side settlement program calls signed by the Privy embedded Solana
 * wallet. Builds each instruction with Anchor, then sends it via Privy's
 * useSendTransaction (embedded-wallet signing).
 */
import * as React from "react";
import { AnchorProvider, BN, Program, web3 } from "@coral-xyz/anchor";
import { useSolanaWallets, useSendTransaction } from "@privy-io/react-auth/solana";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { SOLANA } from "@/lib/txline/config";
import idl from "./opencast_settlement.json";

const connection = new web3.Connection(SOLANA.rpcUrl, "confirmed");
const USDC = new web3.PublicKey(SOLANA.usdcMint || web3.SystemProgram.programId.toBase58());
const PROGRAM_ID = new web3.PublicKey(
  SOLANA.settlementProgramId || web3.SystemProgram.programId.toBase58(),
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function programFor(pubkey: web3.PublicKey): Program<any> {
  const wallet = {
    publicKey: pubkey,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    signTransaction: async (t: any) => t,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    signAllTransactions: async (t: any) => t,
  };
  const provider = new AnchorProvider(connection, wallet as never, {
    commitment: "confirmed",
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new Program(idl as any, provider);
}

export function marketPda(seed: web3.PublicKey): web3.PublicKey {
  return web3.PublicKey.findProgramAddressSync(
    [Buffer.from("market"), seed.toBuffer()],
    PROGRAM_ID,
  )[0];
}

export function positionPda(
  market: web3.PublicKey,
  user: web3.PublicKey,
): web3.PublicKey {
  return web3.PublicKey.findProgramAddressSync(
    [Buffer.from("position"), market.toBuffer(), user.toBuffer()],
    PROGRAM_ID,
  )[0];
}

export function treasuryPda(): web3.PublicKey {
  return web3.PublicKey.findProgramAddressSync(
    [Buffer.from("treasury_v2")],
    PROGRAM_ID,
  )[0];
}

export function parlayBetPda(
  user: web3.PublicKey,
  id: web3.PublicKey,
): web3.PublicKey {
  return web3.PublicKey.findProgramAddressSync(
    [Buffer.from("pbet"), user.toBuffer(), id.toBuffer()],
    PROGRAM_ID,
  )[0];
}

/** On-chain leg of a parlay: a provable predicate + the side the ticket needs. */
export interface ParlayLegChain {
  fixtureId: number;
  statKeyA: number;
  statKeyB: number;
  threshold: number;
  comparison: number;
  expected: number; // 1 = must be YES/true, 0 = must be NO/false
}

export function useSettlement() {
  const { wallets } = useSolanaWallets();
  const { sendTransaction } = useSendTransaction();
  const address = wallets && wallets.length > 0 ? wallets[0].address : null;

  const send = React.useCallback(
    async (tx: web3.Transaction, feePayer: web3.PublicKey) => {
      tx.feePayer = feePayer;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      const res = await sendTransaction({ transaction: tx, connection });
      return res.signature;
    },
    [sendTransaction],
  );

  /** create_market — returns the on-chain market PDA + seed. */
  const createMarket = React.useCallback(
    async (args: {
      fixtureId: number;
      statKeyA: number;
      statKeyB: number;
      threshold: number;
      comparison: number;
      seedAmountUsdc: number;
      /**
       * Opening YES probability (0..1). When set, the seed splits at this
       * ratio via `create_market_split` so the book opens at the line
       * instead of 50/50. Clamped to the program's 5–95% bounds.
       */
      openingYesPct?: number;
    }) => {
      if (!address) throw new Error("Connect a wallet first");
      const user = new web3.PublicKey(address);
      const program = programFor(user);
      const seed = web3.Keypair.generate().publicKey;
      const market = marketPda(seed);
      const vault = getAssociatedTokenAddressSync(USDC, market, true);
      const creatorUsdc = getAssociatedTokenAddressSync(USDC, user, false);
      const baseArgs = [
        seed,
        new BN(args.fixtureId),
        args.statKeyA,
        args.statKeyB,
        args.threshold,
        args.comparison,
        new BN(Math.round(args.seedAmountUsdc * 1e6)),
      ];
      const yesBps =
        args.openingYesPct != null
          ? Math.min(9500, Math.max(500, Math.round(args.openingYesPct * 10_000)))
          : null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const methods = program.methods as any;
      const builder =
        yesBps != null && yesBps !== 5000
          ? methods.createMarketSplit(...baseArgs, yesBps)
          : methods.createMarket(...baseArgs);
      const tx = await builder
        .accounts({
          creator: user,
          market,
          usdcMint: USDC,
          vault,
          creatorUsdc,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: web3.SystemProgram.programId,
        })
        .transaction();
      const sig = await send(tx, user);
      return { market: market.toBase58(), seed: seed.toBase58(), sig };
    },
    [address, send],
  );

  /**
   * place_parlay — stake a fixed-odds parlay ticket. `payout` = stake ×
   * combined multiplier (from live leg prices). Pays from the treasury only if
   * every leg holds. Returns the ticket PDA + its id seed.
   */
  const placeParlay = React.useCallback(
    async (args: {
      legs: ParlayLegChain[];
      stakeUsdc: number;
      payoutUsdc: number;
    }) => {
      if (!address) throw new Error("Connect a wallet first");
      const user = new web3.PublicKey(address);
      const program = programFor(user);
      const id = web3.Keypair.generate().publicKey;
      const bet = parlayBetPda(user, id);
      const treasury = treasuryPda();
      const vault = getAssociatedTokenAddressSync(USDC, treasury, true);
      const userUsdc = getAssociatedTokenAddressSync(USDC, user, false);
      const legs = args.legs.map((l) => ({
        fixtureId: new BN(l.fixtureId),
        statKeyA: l.statKeyA,
        statKeyB: l.statKeyB,
        threshold: l.threshold,
        comparison: l.comparison,
        expected: l.expected,
      }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tx = await (program.methods as any)
        .placeParlay(
          id,
          legs,
          new BN(Math.round(args.stakeUsdc * 1e6)),
          new BN(Math.round(args.payoutUsdc * 1e6)),
        )
        .accounts({
          user,
          bet,
          treasury,
          vault,
          userUsdc,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: web3.SystemProgram.programId,
        })
        .transaction();
      const sig = await send(tx, user);
      return { bet: bet.toBase58(), id: id.toBase58(), sig };
    },
    [address, send],
  );

  /** claim_parlay — a winning ticket pays out from the treasury. */
  const claimParlay = React.useCallback(
    async (args: { bet: string; id: string }) => {
      if (!address) throw new Error("Connect a wallet first");
      const user = new web3.PublicKey(address);
      const program = programFor(user);
      const bet = new web3.PublicKey(args.bet);
      const treasury = treasuryPda();
      const vault = getAssociatedTokenAddressSync(USDC, treasury, true);
      const userUsdc = getAssociatedTokenAddressSync(USDC, user, false);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tx = await (program.methods as any)
        .claimParlay()
        .accounts({
          user,
          bet,
          treasury,
          vault,
          userUsdc,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .transaction();
      return send(tx, user);
    },
    [address, send],
  );

  /** place_prediction — side 1 = YES, 2 = NO. */
  const placePrediction = React.useCallback(
    async (args: { market: string; side: 1 | 2; amountUsdc: number }) => {
      if (!address) throw new Error("Connect a wallet first");
      const user = new web3.PublicKey(address);
      const program = programFor(user);
      const market = new web3.PublicKey(args.market);
      const vault = getAssociatedTokenAddressSync(USDC, market, true);
      const userUsdc = getAssociatedTokenAddressSync(USDC, user, false);
      const position = positionPda(market, user);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tx = await (program.methods as any)
        .placePrediction(args.side, new BN(Math.round(args.amountUsdc * 1e6)))
        .accounts({
          user,
          market,
          position,
          vault,
          userUsdc,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: web3.SystemProgram.programId,
        })
        .transaction();
      return send(tx, user);
    },
    [address, send],
  );

  /** Read the caller's position on a market (null if they never predicted). */
  const readPosition = React.useCallback(
    async (marketStr: string) => {
      if (!address) return null;
      const user = new web3.PublicKey(address);
      const program = programFor(user);
      const market = new web3.PublicKey(marketStr);
      const pos = positionPda(market, user);
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const acc: any = await (program.account as any).position.fetch(pos);
        return {
          yesAmount: Number(acc.yesAmount ?? 0) / 1e6,
          noAmount: Number(acc.noAmount ?? 0) / 1e6,
          claimed: Boolean(acc.claimed),
        };
      } catch {
        return null; // account doesn't exist → never participated
      }
    },
    [address],
  );

  /** claim winnings. */
  const claim = React.useCallback(
    async (args: { market: string }) => {
      if (!address) throw new Error("Connect a wallet first");
      const user = new web3.PublicKey(address);
      const program = programFor(user);
      const market = new web3.PublicKey(args.market);
      const vault = getAssociatedTokenAddressSync(USDC, market, true);
      const userUsdc = getAssociatedTokenAddressSync(USDC, user, false);
      const position = positionPda(market, user);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tx = await (program.methods as any)
        .claim()
        .accounts({
          user,
          market,
          position,
          vault,
          userUsdc,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .transaction();
      return send(tx, user);
    },
    [address, send],
  );

  return {
    address,
    createMarket,
    placeParlay,
    claimParlay,
    placePrediction,
    claim,
    readPosition,
  };
}
