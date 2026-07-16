"use client";

import { shortAddress } from "@/lib/utils";
import { CopyButton } from "./copy-button";

export function AddressDisplay({
  address,
  chars = 4,
  showCopy = true,
  className,
}: {
  address: string;
  chars?: number;
  showCopy?: boolean;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1 font-mono text-sm ${className ?? ""}`}>
      {shortAddress(address, chars)}
      {showCopy && <CopyButton value={address} />}
    </span>
  );
}
