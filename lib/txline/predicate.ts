/**
 * Human-readable rendering of an on-chain market predicate.
 *
 * A predicate is `(statA [- statB]) <cmp> threshold` over TxLINE composite
 * stat keys: `period * 1000 + base`, where base 1/2 = goals (P1/P2),
 * 3/4 = yellow cards, 5/6 = red cards, 7/8 = corners; period 0 = full match,
 * 1 = 1st half, 3 = 2nd half.
 */

const KIND: Record<number, string> = {
  1: "goals",
  2: "goals",
  3: "yellow cards",
  4: "yellow cards",
  5: "red cards",
  6: "red cards",
  7: "corners",
  8: "corners",
};

const PERIOD: Record<number, string> = {
  0: "full-time",
  1: "1st half",
  3: "2nd half",
};

/** "France goals (full-time)" — p1/p2 are TxLINE Participant1/Participant2. */
export function statKeyLabel(key: number, p1: string, p2: string): string {
  const base = key % 1000;
  const period = Math.floor(key / 1000);
  const kind = KIND[base] ?? `stat ${base}`;
  const side = base % 2 === 1 ? p1 : p2;
  const suffix = PERIOD[period] ?? `period ${period}`;
  return `${side} ${kind} (${suffix})`;
}

/**
 * One plain-English sentence for the YES condition, e.g.
 * "YES when France goals (full-time) minus Spain goals (full-time) is
 *  greater than 0."
 */
export function describePredicate(
  p: { statKeyA: number; statKeyB: number; threshold: number; comparison: number },
  p1: string,
  p2: string,
): string {
  const a = statKeyLabel(p.statKeyA, p1, p2);
  const cmp =
    p.comparison === 0
      ? "is greater than"
      : p.comparison === 1
        ? "is less than"
        : "is exactly";
  if (p.statKeyB && p.statKeyB !== 0) {
    const b = statKeyLabel(p.statKeyB, p1, p2);
    return `YES when ${a} minus ${b} ${cmp} ${p.threshold}.`;
  }
  return `YES when ${a} ${cmp} ${p.threshold}.`;
}
