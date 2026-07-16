"use client";

import { useRouter } from "next/navigation";
import { useWallet } from "@/lib/wallet";

/**
 * Final CTA — the packed stadium (downloaded Pexels photo) under an ink wash,
 * one line of copy, one lime button. No mascots, no clutter.
 */
export function FinalCta() {
  const router = useRouter();
  const { authenticated, connect } = useWallet();

  const onCta = () => {
    if (authenticated) router.push("/markets");
    else connect();
  };

  return (
    <div className="relative overflow-hidden rounded-card px-6 py-24 text-center sm:py-32">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/landing/hd-night-pitch.jpg"
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        aria-hidden
      />
      <div className="absolute inset-0 bg-punt-ink/75" />

      <div className="relative mx-auto max-w-3xl">
        <h2 className="text-5xl font-black leading-[0.95] tracking-tight text-punt-paper sm:text-7xl">
          The whistle blows.
          <br />
          The proof pays.
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-base font-medium text-punt-paper/80 sm:text-lg">
          104 matches. Markets anyone can make. Settlement nobody can fake.
        </p>

        <div className="mt-10 flex justify-center">
          <button
            type="button"
            onClick={onCta}
            className="rounded-pill bg-punt-lime px-10 py-4 text-base font-extrabold text-punt-ink transition-transform hover:-translate-y-0.5 sm:text-lg"
          >
            {authenticated ? "Open the app" : "Start betting free"}
          </button>
        </div>
      </div>
    </div>
  );
}
