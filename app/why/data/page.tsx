"use client";

import { WhyPage } from "@/components/why/why-page";
import { IconActivity } from "@/lib/icons";

export default function WhyDataPage() {
  return (
    <WhyPage
      eyebrow="Why OpenCast"
      title="Real-time World Cup data, on-chain."
      lede="Every market on OpenCast is a live World Cup fixture. TxLINE streams official scores, stats, and events straight from the match — the same feed that produces the cryptographic proof a market settles against."
      tone="ink"
      hint={{ Icon: IconActivity, label: "Live feed" }}
      sections={[
        {
          tag: "01",
          title: "One feed, from match to settlement",
          body: (
            <p>
              The scoreboard you watch and the data that settles the market are
              the same source. TxLINE publishes each stat update and anchors its
              Merkle root on Solana, so there&apos;s no gap between what you see
              and what pays out.
            </p>
          ),
        },
        {
          tag: "02",
          title: "What the feed carries",
          body: (
            <p>
              Far more than a scoreline — OpenCast reads the full structured
              stream and renders it live on every market.
            </p>
          ),
          bullets: [
            "Goals, corners, and cards per team, per half.",
            "A running match clock, so you always know the minute.",
            "An event timeline — goals, penalties, cards, VAR, substitutions.",
            "Game state, so a market flips to Full-time the moment the match ends.",
          ],
        },
        {
          tag: "03",
          title: "Live pricing that moves with the match",
          body: (
            <p>
              Because the feed updates in real time, YES/NO pricing reflects the
              pool as the game unfolds. A late goal, a red card, a missed
              penalty — the market reacts, and every trade is a real on-chain
              transaction against the escrow.
            </p>
          ),
        },
        {
          tag: "04",
          title: "Free World Cup tier",
          body: (
            <p>
              OpenCast runs on TxLINE&apos;s free World Cup tier — official
              fixtures, live coverage, and cryptographic stat proofs, all on
              Solana devnet. No API keys for you to manage; the app handles the
              feed and the settlement.
            </p>
          ),
        },
      ]}
    />
  );
}
