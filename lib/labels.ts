import type { Market, Outcome } from "@/lib/types";

/**
 * Display-label helpers.
 *
 * On-chain outcomes are always `Yes` / `No`. Markets can set custom
 * display labels (e.g. "Up"/"Down", "Real Madrid"/"Bayern") to make the
 * UI read naturally. When a label isn't set, fall back to the outcome
 * name so legacy markets and generic yes/no questions still render.
 */

export function yesLabelOf(market: Pick<Market, "yesLabel">): string {
  const v = market.yesLabel?.trim();
  return v || "Yes";
}

export function noLabelOf(market: Pick<Market, "noLabel">): string {
  const v = market.noLabel?.trim();
  return v || "No";
}

export function outcomeLabelOf(
  market: Pick<Market, "yesLabel" | "noLabel">,
  outcome: Outcome | "Yes" | "No" | undefined | null,
): string {
  if (outcome === "Yes") return yesLabelOf(market);
  if (outcome === "No") return noLabelOf(market);
  return "—";
}

/** Are the labels meaningfully different from the default Yes/No? */
export function hasCustomLabels(
  market: Pick<Market, "yesLabel" | "noLabel">,
): boolean {
  const y = market.yesLabel?.trim();
  const n = market.noLabel?.trim();
  return (!!y && y.toLowerCase() !== "yes") || (!!n && n.toLowerCase() !== "no");
}
