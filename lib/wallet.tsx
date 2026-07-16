"use client";

/**
 * Solana wallet session via Privy embedded wallets. Preserves the same
 * `useWallet()` / `useSession()` interface the app already consumes.
 *
 * - `connect` opens Privy's login modal (email / Google / wallet); a Solana
 *   embedded wallet is provisioned on first login.
 * - `address` is the connected Solana wallet's base58 public key.
 * - `usdcBalance` is a live SPL token-account read for NEXT_PUBLIC_USDC_MINT.
 */

import * as React from "react";
import { toast } from "sonner";
import { usePrivy } from "@privy-io/react-auth";
import { useSolanaWallets } from "@privy-io/react-auth/solana";
import { Connection, PublicKey } from "@solana/web3.js";
import { getAccount, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { SOLANA } from "@/lib/txline/config";

const connection = new Connection(SOLANA.rpcUrl, "confirmed");
const USDC_MINT = SOLANA.usdcMint ? new PublicKey(SOLANA.usdcMint) : null;

export type UserRole = "USER" | "ADMIN" | "OWNER" | null;

export interface WalletSession {
  authenticated: boolean;
  connecting: boolean;
  address: string | null;
  usdcBalance: number;
  refreshBalance: () => void;
  connect: (method?: "email" | "google" | "wallet") => Promise<void>;
  disconnect: () => void;
  signAndSend: (label: string, amount?: number) => Promise<string>;
  credit: (amount: number) => void;
  debit: (amount: number) => void;
  role: UserRole;
  chainId: number;
  wrongChain: boolean;
  switchToCorrectChain: () => Promise<void>;
  ensureCorrectChain: () => Promise<void>;
}

const WalletContext = React.createContext<WalletSession | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const { ready, authenticated, login, logout } = usePrivy();
  const { wallets } = useSolanaWallets();

  const wallet = wallets && wallets.length > 0 ? wallets[0] : null;
  const address = wallet?.address ?? null;
  const [usdcBalance, setUsdcBalance] = React.useState(0);

  const refreshBalance = React.useCallback(() => {
    if (!address || !USDC_MINT) {
      setUsdcBalance(0);
      return;
    }
    (async () => {
      try {
        const ata = getAssociatedTokenAddressSync(
          USDC_MINT,
          new PublicKey(address),
          false,
        );
        const acc = await getAccount(connection, ata);
        setUsdcBalance(Number(acc.amount) / 1_000_000);
      } catch {
        setUsdcBalance(0);
      }
    })();
  }, [address]);

  React.useEffect(() => {
    refreshBalance();
  }, [refreshBalance]);

  React.useEffect(() => {
    if (!address) return;
    const id = setInterval(refreshBalance, 30_000);
    return () => clearInterval(id);
  }, [address, refreshBalance]);

  // Auto-fund a fresh embedded wallet on connect: without a little native SOL,
  // Solana can't pay the tx fee + account rent, and Privy blocks the signature
  // with "Add funds on Solana". We top up SOL + test USDC once so the user can
  // create/predict immediately — no manual faucet step, no dead-end prompt.
  const fundedRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!address || fundedRef.current === address) return;
    fundedRef.current = address;
    (async () => {
      try {
        const sol = await connection.getBalance(new PublicKey(address));
        if (sol >= 0.02 * 1_000_000_000) return; // already funded
        await fetch("/api/faucet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet: address }),
        });
        setTimeout(refreshBalance, 2000);
      } catch {
        fundedRef.current = null; // allow a retry on the next render
      }
    })();
  }, [address, refreshBalance]);

  const connect = React.useCallback(async () => {
    login();
  }, [login]);

  const disconnect = React.useCallback(() => {
    logout();
    toast("Disconnected", { description: "Wallet session cleared." });
  }, [logout]);

  const noop = React.useCallback(() => {}, []);
  const asyncNoop = React.useCallback(async () => {}, []);
  const signAndSend = React.useCallback(async () => "", []);

  const value: WalletSession = React.useMemo(
    () => ({
      authenticated: authenticated && !!address,
      // "Still restoring the session" — Privy hasn't hydrated, or it says
      // logged-in but the embedded Solana wallet hasn't loaded yet. UIs must
      // not show signed-out states while this is true.
      connecting: !ready || (authenticated && !address),
      address,
      usdcBalance,
      refreshBalance,
      connect,
      disconnect,
      signAndSend,
      credit: noop,
      debit: noop,
      role: null,
      chainId: 0,
      wrongChain: false,
      switchToCorrectChain: asyncNoop,
      ensureCorrectChain: asyncNoop,
    }),
    [
      ready,
      authenticated,
      address,
      usdcBalance,
      refreshBalance,
      connect,
      disconnect,
      signAndSend,
      noop,
      asyncNoop,
    ],
  );

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
}

export function useWallet(): WalletSession {
  const ctx = React.useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside WalletProvider");
  return ctx;
}

export function useSession() {
  const w = useWallet();
  return {
    user: w.authenticated ? { walletAddr: w.address } : null,
    authenticated: w.authenticated,
    address: w.address,
    wallet: w.authenticated ? { address: w.address } : null,
    ready: true,
    role: w.role,
  };
}

/**
 * Compatibility shim. On-chain writes go through the Solana settlement program
 * (lib/solana); this stub keeps any generic caller importing cleanly.
 */
export function useWriteContract() {
  const writeContractAsync = React.useCallback(async (): Promise<string> => {
    toast.error("On-chain actions are being migrated to Solana.");
    throw new Error("useWriteContract is not available in the Solana build.");
  }, []);
  return {
    writeContract: writeContractAsync,
    writeContractAsync,
    isPending: false,
    data: undefined,
  };
}
