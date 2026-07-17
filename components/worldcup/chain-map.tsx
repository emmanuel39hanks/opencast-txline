"use client";

/**
 * "Settlement stack" panel. TxLINE publishes the verifiable World Cup data
 * (scores + Merkle proofs) that our Solana program checks to release USDC.
 */
export function ChainMap() {
  return (
    <section className="relative overflow-hidden rounded-card border border-punt-ink/8 bg-punt-paper p-8 sm:p-12">
      <div className="grid items-center gap-10 lg:grid-cols-[1.1fr,1fr]">
        <div>
          <span className="punt-sticker -rotate-2 border-punt-ink/80 bg-punt-paper text-punt-ink">
            Settlement stack
          </span>
          <h2
            className="mt-5 font-black tracking-tight text-punt-ink"
            style={{
              fontSize: "clamp(32px, 5vw, 60px)",
              letterSpacing: "-0.03em",
              lineHeight: 0.95,
            }}
          >
            The score decides. Nobody else.
          </h2>
          <p className="mt-4 max-w-md text-sm font-medium text-punt-ink/65 sm:text-base">
            TxLINE anchors every World Cup score to Solana as a cryptographic
            Merkle root. Our settlement program checks that proof on-chain and
            releases USDC to the winners — trustless, no oracle committee.
          </p>
          <ul className="mt-8 space-y-3">
            <Node label="TxLINE" detail="Verifiable scores + on-chain proofs" accent />
            <Node label="Solana" detail="Escrow + trustless settlement" />
            <Node label="USDC" detail="One currency, one wallet" />
          </ul>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-5 rounded-3xl bg-punt-cream/60 p-6 sm:p-8">
          <Tile>
            <Wordmark>TxLINE</Wordmark>
            <Caption>Data + proofs</Caption>
          </Tile>
          <Tile>
            <Wordmark>Solana</Wordmark>
            <Caption>Settlement</Caption>
          </Tile>
          <Tile>
            <Wordmark>USDC</Wordmark>
            <Caption>Collateral</Caption>
          </Tile>
        </div>
      </div>
    </section>
  );
}

function Tile({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-punt-ink/8 bg-punt-paper p-5">
      {children}
    </div>
  );
}

function Wordmark({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-lg font-black tracking-tight text-punt-ink sm:text-xl">
      {children}
    </span>
  );
}

function Caption({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-punt-ink/55">
      {children}
    </span>
  );
}

function Node({
  label,
  detail,
  accent,
}: {
  label: string;
  detail: string;
  accent?: boolean;
}) {
  return (
    <li className="flex items-center gap-3">
      <span
        className={`h-2.5 w-2.5 rounded-full ${
          accent ? "bg-punt-lime" : "bg-punt-ink"
        }`}
      />
      <span className="text-sm font-extrabold text-punt-ink">{label}</span>
      <span className="text-xs font-medium text-punt-ink/55">{detail}</span>
    </li>
  );
}
