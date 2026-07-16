"use client";

import { WhyPage } from "@/components/why/why-page";
import { IconShield } from "@/lib/icons";

export default function WhyVerifiablePage() {
  return (
    <WhyPage
      eyebrow="Why OpenCast"
      title="Every result ships with a proof."
      lede="Polymarket asks you to trust the oracle. OpenCast gives you the proof. TxLINE publishes each official World Cup stat as a Merkle tree and commits the root on Solana — so when a market settles, anyone can re-verify the outcome on-chain."
      tone="lime"
      hint={{ Icon: IconShield, label: "Verifiable" }}
      sections={[
        {
          tag: "01",
          title: "What's in a proof?",
          body: (
            <p>
              A stat proof is the exact data our program checks to settle a
              market — the match result, plus the cryptographic path that ties
              it to TxLINE&apos;s published root.
            </p>
          ),
          bullets: [
            "The proven stat — e.g. France 0, Spain 2 — as full-match goal counts.",
            "The Merkle path from that stat up to TxLINE's event-stat root.",
            "The daily-scores root TxLINE commits on Solana, tying the proof to a specific day.",
            "The fixture id, so a proof for one match can never settle another.",
          ],
        },
        {
          tag: "02",
          title: "How verification works",
          body: (
            <>
              <p>
                On settle, OpenCast&apos;s Solana program makes a cross-program
                call into TxLINE&apos;s{" "}
                <code className="rounded bg-punt-ink/5 px-1.5 py-0.5 font-mono text-xs font-bold">
                  validate_stat_v2
                </code>
                . TxLINE re-hashes the proof against its committed root and
                returns whether the stat is real. Our program reads that boolean
                and nothing else.
              </p>
              <p>
                The escrow can only pay out what the proof confirms. OpenCast
                never touches the outcome, and there is no server in the path.
              </p>
            </>
          ),
        },
        {
          tag: "03",
          title: "No admin, no oracle multisig",
          body: (
            <p>
              There is no privileged key that decides who wins. The score
              decides, checked on-chain by TxLINE&apos;s own program. That&apos;s
              the whole point — settlement is a math check, not a trust
              relationship.
            </p>
          ),
        },
        {
          tag: "04",
          title: "Re-verify it yourself",
          body: (
            <p>
              Every market links to a live proof receipt. Pull up the roots,
              inspect the raw proof JSON, and follow the explorer links to the
              TxLINE oracle and the settlement program on Solana devnet. The
              receipt is the same data the chain checked — you can replay it any
              time.
            </p>
          ),
        },
      ]}
    />
  );
}
