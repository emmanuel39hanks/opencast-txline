import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { BetPreview } from "@/components/landing/bet-preview";
import { BuiltDifferent } from "@/components/landing/built-different";
import { MarketsPreview } from "@/components/landing/markets-preview";
import { Rails } from "@/components/landing/rails";
import { FaqSection } from "@/components/landing/faq-section";
import { FinalCta } from "@/components/landing/final-cta";
import { LandingFooter } from "@/components/landing/landing-footer";

/**
 * OpenCast landing — the app first, the pitch second. Order:
 *
 *   1. Header (wordmark + Connect Wallet)
 *   2. Hero — plain-English pitch + the real board: a live market card,
 *      a settled receipt, the World Cup itself
 *   3. Live markets grid (real data — the product sells itself)
 *   4. How it works (type a bet / back a side / proof settles it)
 *   5. Feature triptych (create · bet & parlay · trustless settle)
 *   6. Bet preview (market card + receipt + trade panel bento)
 *   7. Why it's different (bento)
 *   8. The rails (Solana + TxLINE by TxODDS — real logos, real addresses)
 *   9. FAQ (plain English, honest)
 *  10. Final CTA (stadium photo)
 *  11. Footer
 */
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-punt-cream">
      {/* Full-bleed hero — photo runs edge to edge, navbar sits on it */}
      <Hero />

      <div className="mx-auto max-w-[1440px] space-y-24 px-4 py-16 sm:space-y-32 sm:px-8 sm:py-20">
        <MarketsPreview />
        <HowItWorks />
        <BetPreview />
        <BuiltDifferent />
        <Rails />
        <FaqSection />
        <FinalCta />
      </div>

      <div className="mx-auto max-w-[1440px] px-4 sm:px-8">
        <LandingFooter />
      </div>
    </div>
  );
}
