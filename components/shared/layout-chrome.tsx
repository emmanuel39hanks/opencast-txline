"use client";

import { usePathname } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { AppHeader } from "@/components/shared/app-header";

/**
 * Layout chrome dispatcher.
 *
 *  - `/`             → owns its own marketing header, footer, and full-bleed
 *                       hero, so we render the page bare.
 *  - everything else → the app header sits sticky at the top with the
 *                       wordmark / search / Portfolio chips / avatar menu.
 *                       Page content drops onto the cream page background.
 */
export function LayoutChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isLanding = pathname === "/";

  if (isLanding) {
    return <main className="min-h-screen bg-background">{children}</main>;
  }

  return (
    <div className="flex min-h-screen flex-col bg-punt-cream">
      {/* AppHeader reads useSearchParams() internally, so it must be wrapped in
          <Suspense> for the surrounding tree to prerender. */}
      <Suspense fallback={<div className="h-14 border-b border-punt-ink/8 bg-punt-paper" />}>
        <AppHeader />
      </Suspense>
      <main className="flex-1">{children}</main>
    </div>
  );
}
