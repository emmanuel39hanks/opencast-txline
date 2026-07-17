"use client";

import * as React from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useWallet } from "@/lib/wallet";
import { cn } from "@/lib/utils";

/**
 * Landing header. `onDark` renders the light variant so it can sit on top of
 * the full-bleed hero photo. Below `md` the center nav collapses into a
 * hamburger sheet so every destination stays reachable on phones.
 */
export function LandingHeader({ onDark = false }: { onDark?: boolean }) {
  const { authenticated, connecting, connect } = useWallet();
  const [open, setOpen] = React.useState(false);

  const links = [
    { href: "/markets", label: "Markets" },
    { href: "/leaderboard", label: "Leaderboard" },
    { href: "/parlays/new", label: "Parlays" },
    { href: "/create", label: "Create" },
  ];

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
        {links.map((l) => (
          <NavPill key={l.href} href={l.href} onDark={onDark}>
            {l.label}
          </NavPill>
        ))}
      </nav>

      <div className="flex items-center gap-2">
        {connecting ? (
          <div
            className={cn(
              "h-11 w-28 animate-pulse rounded-pill sm:w-32",
              onDark ? "bg-punt-paper/15" : "bg-punt-ink/[0.06]",
            )}
          />
        ) : authenticated ? (
          <Link
            href="/markets"
            className={cn(
              "rounded-pill px-4 py-2.5 text-sm font-bold transition-transform hover:-translate-y-0.5 sm:px-6 sm:py-3",
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
              "rounded-pill px-4 py-2.5 text-sm font-bold transition-transform hover:-translate-y-0.5 sm:px-6 sm:py-3",
              onDark
                ? "bg-punt-lime text-punt-ink"
                : "bg-punt-ink text-punt-paper",
            )}
          >
            Connect Wallet
          </button>
        )}

        {/* Mobile menu toggle */}
        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "grid h-10 w-10 place-items-center rounded-pill md:hidden",
            onDark
              ? "bg-punt-paper/10 text-punt-paper"
              : "bg-punt-ink/5 text-punt-ink",
          )}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile nav sheet */}
      {open && (
        <div className="absolute inset-x-2 top-full z-50 mt-1 overflow-hidden rounded-2xl border border-punt-ink/10 bg-punt-paper shadow-[0_24px_60px_-24px_rgba(10,10,10,0.45)] md:hidden">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block border-b border-punt-ink/[0.05] px-5 py-3.5 text-sm font-bold text-punt-ink last:border-b-0 hover:bg-punt-cream/50"
            >
              {l.label}
            </Link>
          ))}
        </div>
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
