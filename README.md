# OpenCast — provable World Cup prediction markets on Solana

**Live at [opencast.cc](https://www.opencast.cc)** · Solana devnet · powered by
the [TxLINE](https://txline.txodds.com) data layer by TxODDS.

OpenCast is a prediction board anyone can add to. Type a prediction in plain English —
*"England to score 2+"* — and an AI drafts it into an on-chain market bound to
a real World Cup fixture. Back YES or NO with USDC at pool odds, or stack
picks into a parlay. When the final whistle blows, a **cryptographic Merkle
proof of the score settles the market automatically** — no bookmaker, no
admin, no oracle multisig. Every resolution ships a receipt anyone can
re-verify.

> Submission for the TxODDS **TxLINE World Cup** track (Superteam Earn).
> Devnet build — test USDC is free from the in-app faucet; sign in with email,
> no wallet or gas needed.

## Architecture

```
                    ┌────────────────────────────────────────────┐
                    │              TxLINE (TxODDS)               │
                    │  fixtures · live scores (SSE) · odds feed  │
                    │  Merkle stat proofs (/scores/stat-validation)
                    └────────┬───────────────────────┬───────────┘
                             │ data                  │ proof
┌───────────────┐   ┌────────▼────────┐   ┌──────────▼──────────────┐
│  Privy email  │   │   Next.js app   │   │  keeper (Vercel cron)   │
│  wallets      ├───►  (app + API     │   │  finality gates +       │
└───────────────┘   │   routes, Neon) │   │  independent Merkle     │
                    └────────┬────────┘   │  recomputation gate     │
                             │ tx         └──────────┬──────────────┘
                    ┌────────▼───────────────────────▼───────────┐
                    │      opencast_settlement (Anchor)          │
                    │  markets · parimutuel pools · parlays      │
                    │  settle = CPI → txoracle.validate_stat_v2  │
                    └────────────────────────────────────────────┘
```

- **Markets** are program accounts holding a YES/NO predicate over TxLINE
  stat keys: `(statA [− statB]) <cmp> threshold`. Goals, cards, corners —
  full match, first or second half. If a stat can't be proven from match
  data, the market can't be created.
- **Odds are the pool.** Parimutuel: price = side stake ÷ total; winners
  split the whole pool pro-rata minus a 2% platform fee. TxODDS' own
  demargined line is shown next to the pool price as a reference.
- **Parlays** are tickets over existing markets (Polymarket-style picks) at
  live pool prices, paid from a treasury with on-chain liability
  reservation; each leg is proven individually via CPI, and the ticket pays
  only if every leg holds.
- **Settlement** is trustless: `settle_market` CPIs into TxLINE's on-chain
  `txoracle.validate_stat_v2` with the Merkle proof; the chain checks the
  stat. A keeper (cron, permissionless to trigger) sweeps finished fixtures.
- **Custom check gate:** before settling or displaying a proof we
  *independently recompute* its Merkle chain (plain sha256 pair-hashing,
  verified against known roots — see `lib/txline/merkle.ts`); proofs that
  don't reconcile are refused.
- **Receipts:** `/verify/[fixtureId]` shows the scoreboard, the exact stat
  leaves, the named scorers/cards (from lineups + PlayerStats), the full
  hash path to the on-chain root, and explorer links.

## TxLINE endpoints used

| Endpoint | Use |
| --- | --- |
| `POST /auth/guest/start` | short-lived JWT (auto-renewed on silent 401s) |
| on-chain `subscribe` + activate | mints the long-lived `X-Api-Token` (`scripts/txline-activate.ts`) |
| `GET /fixtures/snapshot?competitionId=72&startEpochDay=N` | 45-day sweep → all 104 tournament fixtures |
| `GET /scores/snapshot/{fixtureId}` | score history, finality, player stats, lineups |
| `GET /scores/stream` (SSE) | live match card (proxied via `/api/stream/[fixtureId]`) |
| `GET /scores/stat-validation?fixtureId&seq&statKeys` | the Merkle proof our program settles against |
| `GET /odds/snapshot/{fixtureId}` | TxODDS 1X2 reference line on market pages |
| `txoracle.validate_stat_v2` (CPI) | on-chain proof verification at settlement |

## Stack

- **App:** Next.js (App Router) on Vercel; API route handlers; Prisma + Neon
  Postgres; Privy embedded Solana wallets (email login).
- **Chain:** Solana devnet. Anchor program in `program/` (markets, pools,
  parlays, treasury). Test USDC mint + faucet.
- **AI drafting:** 0G inference router (`lib/zerog/`) maps plain English to a
  deterministic, provable predicate — never to an unprovable market.

## Run locally

```bash
cp .env.example .env       # fill in the values
npm install
npx prisma generate
npm run dev                # http://localhost:3010
```

