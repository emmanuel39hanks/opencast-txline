"use client";

import { ParlayBuilder } from "@/components/create/parlay-builder";
import { IconFlash } from "@/lib/icons";

/**
 * /parlays/new — build a parlay ticket from existing markets. Distinct from
 * /create (which mints new markets): a parlay doesn't create anything tradeable,
 * it bundles YES/NO picks on live pools into one fixed-odds bet.
 */
export default function NewParlayPage() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      <span className="punt-sticker -rotate-2 border-punt-ink/80 bg-punt-lime text-punt-ink">
        <IconFlash size={11} variant="Bold" color="#0A0A0A" />
        All picks must hit
      </span>
      <h1 className="mt-3 text-3xl font-black leading-tight text-punt-ink sm:text-4xl">
        Build a parlay
      </h1>
      <p className="mt-2 max-w-xl text-sm font-medium leading-relaxed text-punt-ink/60">
        Stack YES/NO picks from live markets into one ticket. Odds come from each
        market&apos;s pool; every pick settles trustlessly against its own TxLINE
        proof.
      </p>
      <ParlayBuilder />
    </div>
  );
}
