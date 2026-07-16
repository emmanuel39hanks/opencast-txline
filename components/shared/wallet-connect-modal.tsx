"use client";

import * as React from "react";
import { useWallet } from "@/lib/wallet";

/**
 * Thin shell that forwards to the Solana wallet-adapter modal. Kept so legacy
 * call sites (e.g. unauthed empty states on /portfolio, /my-markets) don't
 * need to change their prop signature — when `open` is set we open the wallet
 * modal and immediately close our own.
 */
export function WalletConnectModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { connect, authenticated } = useWallet();

  React.useEffect(() => {
    if (open && !authenticated) {
      connect();
      onOpenChange(false);
    }
  }, [open, authenticated, connect, onOpenChange]);

  return null;
}
