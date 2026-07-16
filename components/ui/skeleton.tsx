import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Loading skeleton — Punt-tinted. Uses a fixed `punt-ink/[0.06]` colour so
 * the shimmer reads on the cream page background and on the white paper
 * cards alike. Pure CSS pulse, no shimmer-keyframe lib needed.
 */
function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-xl bg-punt-ink/[0.06]",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
