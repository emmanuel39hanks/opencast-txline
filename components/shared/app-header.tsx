"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  IconWallet,
  IconTrendUp,
  IconCoin,
  IconReceipt,
  IconStar,
  IconChevronDown,
  IconClose,
  IconCpu,
  IconFlash,
} from "@/lib/icons";
import {
  Flame,
  Bitcoin,
  Trophy,
  CloudSun,
  Newspaper,
  Landmark,
  Clapperboard,
  Search,
  X,
} from "lucide-react";
import type { MarketCategory } from "@/lib/types";
import { useWallet } from "@/lib/wallet";
import { useMyPositions } from "@/lib/hooks/useClaim";
import { formatMoney, shortAddress, cn } from "@/lib/utils";
import { toast } from "sonner";

/**
 * Polymarket-style app header for authenticated routes.
 *
 *   [OPENCAST •]   [ search…           / ]   Portfolio $X  Cash $Y  [ Mint USDC ]  [avatar▾]
 *
 *  - Sticky, cream bg with a hairline bottom border.
 *  - Wordmark links to /markets (the app home for signed-in users).
 *  - Search routes to /markets?search=… on submit.
 *  - Portfolio / Cash chips show live numbers when authenticated.
 *  - The avatar dropdown owns Create / Portfolio / My markets / Settings /
 *    Faucet / Sign out, keeping the top nav uncluttered.
 *  - Anonymous users see a single black "Connect Wallet" pill (no icon).
 */
export function AppHeader() {
  const { authenticated, connecting, address, usdcBalance, connect } = useWallet();

  return (
    <header className="sticky top-0 z-40 border-b border-punt-ink/[0.07] bg-punt-cream/85 backdrop-blur-md supports-[backdrop-filter]:bg-punt-cream/70">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-5 px-4 sm:px-6">
        <Link
          href={authenticated ? "/markets" : "/"}
          className="flex items-center gap-2.5 text-[22px] font-black tracking-tight text-punt-ink sm:text-[24px]"
          style={{ letterSpacing: "-0.04em" }}
        >
          <span className="h-2.5 w-2.5 rounded-full bg-punt-lime" />
          OPENCAST
        </Link>

        <SearchBar />

        <div className="ml-auto flex items-center gap-2 sm:gap-4">
          {connecting ? (
            /* Session hydrating — neutral placeholders, no signed-out flash */
            <>
              <div className="hidden h-9 w-40 animate-pulse rounded-pill bg-punt-ink/[0.05] lg:block" />
              <div className="h-10 w-10 animate-pulse rounded-pill bg-punt-ink/[0.06]" />
            </>
          ) : authenticated ? (
            <>
              <PortfolioStats usdcBalance={usdcBalance} />
              <MintUsdcPill />
              <UserMenu address={address} usdcBalance={usdcBalance} />
            </>
          ) : (
            <button
              type="button"
              onClick={() => connect()}
              className="rounded-pill bg-punt-ink px-5 py-2.5 text-sm font-bold text-punt-paper transition-transform hover:-translate-y-0.5"
            >
              Connect Wallet
            </button>
          )}
        </div>
      </div>

      {/* Mobile search — its own row; the inline bar is desktop-only */}
      <div className="px-4 pb-2 md:hidden">
        <SearchBar mobile />
      </div>

      {/* Category nav — second row, same sticky unit */}
      <CategoryNav />
    </header>
  );
}

// ─── Category nav (global, drives /markets?category=) ─────────────────────

const CATEGORIES: {
  label: string;
  value: MarketCategory | "all";
  Icon: React.ElementType;
}[] = [
  { label: "Trending", value: "all", Icon: Flame },
  { label: "Crypto", value: "crypto", Icon: Bitcoin },
  { label: "Sports", value: "sports", Icon: Trophy },
  { label: "Weather", value: "weather", Icon: CloudSun },
  { label: "News", value: "news", Icon: Newspaper },
  { label: "Politics", value: "politics", Icon: Landmark },
  { label: "Entertainment", value: "entertainment", Icon: Clapperboard },
];

function CategoryNav() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  // Highlight the active category only on the markets index.
  const active = pathname === "/markets" ? (params.get("category") ?? "all") : "";

  const go = (v: MarketCategory | "all") => {
    const search = params.get("search");
    const qs = new URLSearchParams();
    if (v !== "all") qs.set("category", v);
    if (search) qs.set("search", search);
    router.push(qs.toString() ? `/markets?${qs}` : "/markets");
  };

  return (
    <nav className="mx-auto flex max-w-[1440px] items-center gap-1 overflow-x-auto px-2 pb-2 no-scrollbar sm:px-4">
      {CATEGORIES.map((c) => {
        const isActive = active === c.value;
        return (
          <button
            key={c.value}
            type="button"
            onClick={() => go(c.value)}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-pill px-3.5 py-1.5 text-[13px] font-bold transition-colors",
              isActive
                ? "bg-punt-ink text-punt-paper"
                : "text-punt-ink/60 hover:bg-punt-ink/[0.06] hover:text-punt-ink",
            )}
          >
            <c.Icon
              className={cn(
                "h-[15px] w-[15px]",
                isActive ? "text-punt-lime" : "text-punt-ink/45",
              )}
              strokeWidth={2.25}
            />
            {c.label}
          </button>
        );
      })}
    </nav>
  );
}

// ─── Search ────────────────────────────────────────────────────────────────

function SearchBar({ mobile = false }: { mobile?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [value, setValue] = React.useState(
    pathname === "/markets" ? (params.get("search") ?? "") : "",
  );

  // Keep search in sync when navigating between markets URLs.
  React.useEffect(() => {
    if (pathname === "/markets") {
      setValue(params.get("search") ?? "");
    }
  }, [pathname, params]);

  // "/" keyboard shortcut to focus the search input — Polymarket UX hint.
  // (Desktop instance only — the mobile row must not steal the shortcut.)
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (mobile) return;
      if (e.key !== "/" || e.metaKey || e.ctrlKey) return;
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA"].includes(target.tagName)) return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = value.trim();
    router.push(q ? `/markets?search=${encodeURIComponent(q)}` : "/markets");
  };

  return (
    <form
      onSubmit={onSubmit}
      className={mobile ? "block md:hidden" : "hidden flex-1 md:block"}
    >
      <div className="group relative mx-auto max-w-xl">
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          type="text"
          placeholder="Search markets"
          className="h-10 w-full rounded-pill border border-punt-ink/[0.08] bg-punt-paper pl-10 pr-10 text-sm font-medium text-punt-ink shadow-[0_1px_2px_rgba(10,10,10,0.04)] transition-colors placeholder:text-punt-ink/40 hover:border-punt-ink/20 focus:border-punt-ink/25 focus:outline-none focus:ring-[3px] focus:ring-punt-lime/35"
        />
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-punt-ink/40 transition-colors group-focus-within:text-punt-ink"
          strokeWidth={2.25}
          aria-hidden
        />
        {value ? (
          <button
            type="button"
            onClick={() => {
              setValue("");
              inputRef.current?.focus();
              if (pathname === "/markets") router.push("/markets");
            }}
            className="absolute right-2.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-pill text-punt-ink/50 transition-colors hover:bg-punt-ink/5 hover:text-punt-ink"
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2.5} />
          </button>
        ) : mobile ? null : (
          <kbd className="pointer-events-none absolute right-3.5 top-1/2 grid h-5 w-5 -translate-y-1/2 place-items-center rounded-md bg-punt-ink/[0.05] font-mono text-[10px] font-bold text-punt-ink/40 group-focus-within:opacity-0">
            /
          </kbd>
        )}
      </div>
    </form>
  );
}

// ─── Portfolio + Cash chips ───────────────────────────────────────────────

function PortfolioStats({ usdcBalance }: { usdcBalance: number }) {
  // Sum of currentValue across open positions — same hook portfolio uses.
  const { data } = useMyPositions();
  const portfolioValue = (data ?? []).reduce(
    (acc, p) => acc + (p.currentValue ?? 0),
    0,
  );

  return (
    <div className="hidden items-center gap-5 lg:flex">
      <Stat label="Portfolio" value={`$${formatMoney(portfolioValue)}`} accent="lime" href="/portfolio" />
      <Stat label="Cash" value={`$${formatMoney(usdcBalance)}`} accent="ink" />
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
  href,
}: {
  label: string;
  value: string;
  accent: "lime" | "ink";
  href?: string;
}) {
  const valueClass =
    accent === "lime" ? "text-emerald-600" : "text-punt-ink";
  const inner = (
    <div className="leading-tight">
      <div className="text-[10px] font-bold uppercase tracking-wider text-punt-ink/45">
        {label}
      </div>
      <div className={`text-sm font-extrabold tabular-nums ${valueClass}`}>
        {value}
      </div>
    </div>
  );
  return href ? (
    <Link href={href} className="rounded-md transition-opacity hover:opacity-70">
      {inner}
    </Link>
  ) : (
    inner
  );
}

// ─── Mint USDC pill (testnet stand-in for "Deposit") ──────────────────────

function MintUsdcPill() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.push("/settings#faucet")}
      className="hidden rounded-pill bg-punt-lime px-4 py-2.5 text-sm font-extrabold text-punt-ink transition-transform hover:-translate-y-0.5 sm:inline-flex"
    >
      <span>Get Test USDC</span>
    </button>
  );
}

// ─── User dropdown — Create lives here, not in the nav ────────────────────

function UserMenu({
  address,
  usdcBalance,
}: {
  address: string | null;
  usdcBalance: number;
}) {
  const { disconnect } = useWallet();

  const handleCopy = () => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    toast("Address copied");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-pill border border-punt-ink/10 bg-punt-paper px-2 py-1.5 transition-transform hover:-translate-y-0.5"
          aria-label="Account menu"
        >
          <Avatar address={address} />
          <IconChevronDown size={14} color="#0A0A0A" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-72 overflow-hidden rounded-2xl border-punt-ink/10 bg-punt-paper p-0 shadow-[0_24px_60px_-24px_rgba(10,10,10,0.35)]"
      >
        {/* Identity header — cream band, copy inline */}
        <DropdownMenuLabel className="bg-punt-cream/70 px-4 py-3.5">
          <div className="flex items-center gap-3">
            <Avatar address={address} size={38} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate font-mono text-[13px] font-extrabold text-punt-ink">
                  {address ? shortAddress(address, 5) : "—"}
                </span>
                <button
                  type="button"
                  onClick={handleCopy}
                  aria-label="Copy address"
                  className="grid h-5 w-5 shrink-0 place-items-center rounded-md text-punt-ink/40 transition-colors hover:bg-punt-ink/10 hover:text-punt-ink"
                >
                  <IconWallet size={12} variant="Linear" color="currentColor" />
                </button>
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[11px] font-bold text-punt-ink/55">
                ${formatMoney(usdcBalance)} USDC
                <span className="inline-flex items-center gap-1 rounded-pill bg-punt-ink/[0.06] px-1.5 py-px text-[9px] font-extrabold uppercase tracking-wide text-punt-ink/50">
                  <span className="h-1 w-1 rounded-full bg-punt-lime" />
                  Devnet
                </span>
              </div>
            </div>
          </div>
        </DropdownMenuLabel>

        {/* Primary action */}
        <div className="p-2 pb-1">
          <DropdownMenuItem asChild className="rounded-xl p-0">
            <Link
              href="/create"
              className="flex w-full items-center justify-center gap-2 rounded-xl !bg-punt-lime py-2.5 text-sm font-extrabold !text-punt-ink transition-all hover:!bg-[#B9E75A] focus:!bg-[#B9E75A] data-[highlighted]:!bg-[#B9E75A]"
            >
              <IconStar size={15} variant="Bold" color="#0A0A0A" />
              Create market
            </Link>
          </DropdownMenuItem>
        </div>

        <div className="p-1.5">
          <MenuItem href="/portfolio" Icon={IconTrendUp} label="Portfolio" />
          <MenuItem href="/parlays" Icon={IconFlash} label="Parlays" />
          <MenuItem href="/my-markets" Icon={IconReceipt} label="Markets I created" />
          <MenuItem href="/settings#faucet" Icon={IconCoin} label="Get test USDC" />
          <MenuItem href="/settings" Icon={IconCpu} label="Settings" />
        </div>

        <DropdownMenuSeparator className="my-0 bg-punt-ink/[0.06]" />

        <div className="p-1.5">
          <DropdownMenuItem
            onClick={disconnect}
            className="flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-bold text-rose-600 hover:!bg-rose-50 hover:!text-rose-700"
          >
            <IconClose size={15} variant="Linear" />
            Sign out
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MenuItem({
  href,
  Icon,
  label,
}: {
  href: string;
  Icon: React.ElementType;
  label: string;
}) {
  return (
    <DropdownMenuItem asChild className="rounded-xl">
      <Link
        href={href}
        className="flex items-center gap-3 px-3 py-2 text-sm font-bold text-punt-ink/80 hover:!bg-punt-ink/[0.04] hover:!text-punt-ink"
      >
        <Icon size={16} variant="Linear" color="#0A0A0A" className="opacity-60" />
        {label}
      </Link>
    </DropdownMenuItem>
  );
}

/**
 * Polymarket-style watercolour avatar. Four overlapping radial gradients,
 * each anchored at a corner-ish position with a colour seeded from the
 * wallet address. The radials fade to transparent so they blend into a
 * soft, multi-tone blob — same address always gets the same blob.
 *
 * No text on top — it's a pure visual mark like Polymarket / Boring
 * Avatars / Vercel-style watercolour identicons.
 */
const AVATAR_PALETTE = [
  "#FF6B6B", "#FFA94D", "#FFD43B", "#A9E34B", "#69DB7C",
  "#38D9A9", "#3BC9DB", "#4DABF7", "#748FFC", "#9775FA",
  "#DA77F2", "#F06595", "#F783AC", "#FF8787", "#FFC078",
  "#FAB005", "#82C91E", "#20C997", "#15AABF", "#228BE6",
];

// `_textClassName` retained for API back-compat; the new visual mark has
// no text overlay so the prop is ignored.
export function Avatar({
  address,
  size = 28,
  textClassName: _textClassName,
}: {
  address: string | null;
  size?: number;
  textClassName?: string;
}) {
  const background = React.useMemo(() => {
    if (!address) {
      return buildBlob([0, 1, 2, 3], [25, 75, 25, 75], [25, 25, 75, 75]);
    }
    // Six independent hashes off the address — four colour indices and
    // two position offsets. Keeps the same wallet stable across renders.
    const hashes: number[] = [];
    let h = 0;
    for (let i = 0; i < address.length; i++) {
      h = (h * 33 + address.charCodeAt(i)) & 0x7fffffff;
      if (i % 4 === 3) hashes.push(h);
    }
    while (hashes.length < 6) hashes.push((hashes[hashes.length - 1] ?? 1) * 17);
    const colourIdx = [
      hashes[0] % AVATAR_PALETTE.length,
      hashes[1] % AVATAR_PALETTE.length,
      hashes[2] % AVATAR_PALETTE.length,
      hashes[3] % AVATAR_PALETTE.length,
    ];
    // Spread anchor points around so the blobs don't all stack in the centre.
    const xs = [20 + (hashes[4] % 30), 70 + (hashes[5] % 20), 80 - (hashes[0] % 30), 20 + (hashes[1] % 25)];
    const ys = [25 + (hashes[2] % 25), 25 + (hashes[3] % 20), 70 + (hashes[4] % 20), 75 - (hashes[5] % 25)];
    return buildBlob(colourIdx, xs, ys);
  }, [address]);

  return (
    <span
      className="block shrink-0 overflow-hidden rounded-pill"
      style={{
        width: size,
        height: size,
        background,
        filter: "saturate(1.15)",
      }}
      aria-hidden
    />
  );
}

/**
 * Composes the four-radial watercolour gradient. Each stop fades to
 * transparent at 55% so the colours bleed into each other rather than
 * hard-edge against a base.
 */
function buildBlob(
  colourIdx: number[],
  xs: number[],
  ys: number[],
): string {
  const stops = colourIdx.map((idx, i) => {
    const color = AVATAR_PALETTE[idx % AVATAR_PALETTE.length];
    return `radial-gradient(circle at ${xs[i]}% ${ys[i]}%, ${color} 0%, ${hexToRgba(color, 0)} 60%)`;
  });
  // Soft cream base so the blob never reveals page background through gaps.
  return `${stops.join(", ")}, #F2F2EE`;
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
