"use client";

import * as React from "react";
import Link from "next/link";
import { useWallet } from "@/lib/wallet";
import { cn } from "@/lib/utils";

/**
 * Landing header. `onDark` renders the light variant so it can sit on top of
 * the full-bleed hero photo.
 */
export function LandingHeader({ onDark = false }: { onDark?: boolean }) {
  const { authenticated, connecting, connect } = useWallet();

  return (
    <div className="relative flex items-center justify-between px-2 py-5 sm:px-4">
      <Link
        href="/"
        className={cn(
          "flex items-center gap-3 text-[26px] font-black tracking-tight sm:text-[32px]",
          onDark ? "text-punt-paper" : "text-punt-ink",
        )}
        style={{ letterSpacing: "-0.04em" }}
      >
        <span className="h-4 w-4 rounded-full bg-punt-lime sm:h-[18px] sm:w-[18px]" />
        OPENCAST
      </Link>

      {/* Absolutely centered so it lines up with logo + CTA on every width */}
      <nav className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-1 md:flex">
        <NavPill href="/markets" onDark={onDark}>Markets</NavPill>
        <NavPill href="/leaderboard" onDark={onDark}>Leaderboard</NavPill>
        <NavPill href="/parlays/new" onDark={onDark}>Parlays</NavPill>
        <NavPill href="/create" onDark={onDark}>Create</NavPill>
      </nav>

      {connecting ? (
        <div
          className={cn(
            "h-11 w-32 animate-pulse rounded-pill",
            onDark ? "bg-punt-paper/15" : "bg-punt-ink/[0.06]",
          )}
        />
      ) : authenticated ? (
        <Link
          href="/markets"
          className={cn(
            "rounded-pill px-6 py-3 text-sm font-bold transition-transform hover:-translate-y-0.5",
            onDark
              ? "bg-punt-lime text-punt-ink"
              : "bg-punt-ink text-punt-paper",
          )}
        >
          Open App
        </Link>
      ) : (
        <button
          type="button"
          onClick={() => connect()}
          className={cn(
            "rounded-pill px-6 py-3 text-sm font-bold transition-transform hover:-translate-y-0.5",
            onDark
              ? "bg-punt-lime text-punt-ink"
              : "bg-punt-ink text-punt-paper",
          )}
        >
          Connect Wallet
        </button>
      )}
    </div>
  );
}

function NavPill({
  href,
  children,
  onDark,
}: {
  href: string;
  children: React.ReactNode;
  onDark?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-pill px-4 py-2 text-sm font-medium transition-colors",
        onDark
          ? "text-punt-paper/70 hover:bg-punt-paper/10 hover:text-punt-paper"
          : "text-punt-ink/70 hover:bg-punt-ink/5 hover:text-punt-ink",
      )}
    >
      {children}
    </Link>
  );
}
