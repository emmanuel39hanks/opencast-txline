import { Check, Minus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Outcome } from "@/lib/types";

export function OutcomeIcon({
  outcome,
  size = 16,
  className,
}: {
  outcome?: Outcome;
  size?: number;
  className?: string;
}) {
  if (outcome === "Yes")
    return (
      <span className={cn("inline-flex rounded-full bg-success/15 text-success p-1", className)}>
        <Check style={{ width: size, height: size }} />
      </span>
    );
  if (outcome === "No")
    return (
      <span className={cn("inline-flex rounded-full bg-destructive/15 text-destructive p-1", className)}>
        <X style={{ width: size, height: size }} />
      </span>
    );
  return (
    <span className={cn("inline-flex rounded-full bg-muted text-muted-foreground p-1", className)}>
      <Minus style={{ width: size, height: size }} />
    </span>
  );
}
