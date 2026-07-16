"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { PrivyProvider } from "@privy-io/react-auth";

import { TooltipProvider } from "@/components/ui/tooltip";
import { WalletProvider } from "@/lib/wallet";
import { SOLANA } from "@/lib/txline/config";

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";

/**
 * App providers. Privy provides Solana embedded wallets (email → wallet, no
 * extension needed) plus external Solana wallets. Devnet cluster.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [qc] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ["email", "wallet"],
        appearance: {
          theme: "light",
          accentColor: "#0A0A0A",
          walletChainType: "solana-only",
        },
        embeddedWallets: {
          // Solana-only app: provision a Solana embedded wallet on login.
          // NB: the top-level `createOnLogin` provisions an ETHEREUM wallet
          // in Privy v2 — Solana needs this nested `solana.createOnLogin`,
          // otherwise useSolanaWallets() stays empty and `address` is null.
          ethereum: { createOnLogin: "off" },
          solana: { createOnLogin: "all-users" },
        },
        solanaClusters: [{ name: "devnet", rpcUrl: SOLANA.rpcUrl }],
      }}
    >
      <QueryClientProvider client={qc}>
        <WalletProvider>
          <TooltipProvider delayDuration={200}>
            {children}
            <Toaster
              position="bottom-right"
              richColors
              closeButton
              theme="light"
            />
          </TooltipProvider>
        </WalletProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}
