"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatUsdc } from "@/lib/utils";
import { useWallet } from "@/lib/wallet";

export function USDCInput({
  value,
  onChange,
  max,
  placeholder = "0.00",
  className,
  showBalance = true,
  disabled,
}: {
  value: number | "";
  onChange: (v: number) => void;
  max?: number;
  placeholder?: string;
  className?: string;
  showBalance?: boolean;
  disabled?: boolean;
}) {
  const { usdcBalance, authenticated } = useWallet();
  const effectiveMax = max ?? (authenticated ? usdcBalance : Infinity);
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="relative">
        <Input
          inputMode="decimal"
          type="number"
          disabled={disabled}
          placeholder={placeholder}
          value={value === "" ? "" : String(value)}
          onChange={(e) => {
            const next = e.target.value === "" ? 0 : parseFloat(e.target.value);
            onChange(isNaN(next) ? 0 : next);
          }}
          className="pr-24 font-mono text-base"
        />
        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
          <span className="text-xs font-medium text-muted-foreground">USDC</span>
          {effectiveMax !== Infinity && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-[11px]"
              disabled={disabled}
              onClick={() => onChange(Math.floor(effectiveMax * 100) / 100)}
            >
              MAX
            </Button>
          )}
        </div>
      </div>
      {showBalance && authenticated && (
        <p className="text-[11px] text-muted-foreground">
          Balance: <span className="font-mono">{formatUsdc(usdcBalance)}</span> USDC
        </p>
      )}
    </div>
  );
}
