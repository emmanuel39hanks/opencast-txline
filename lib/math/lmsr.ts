// Pure client-side LMSR cost + price functions.
// C(q) = b * ln(exp(qYes/b) + exp(qNo/b))
// price_yes = exp(qYes/b) / (exp(qYes/b) + exp(qNo/b))

export function lmsrCost(qYes: number, qNo: number, b: number): number {
  // numerically stable log-sum-exp
  const m = Math.max(qYes, qNo);
  return b * (m / b + Math.log(Math.exp((qYes - m) / b) + Math.exp((qNo - m) / b)));
}

export function lmsrPriceYes(qYes: number, qNo: number, b: number): number {
  const m = Math.max(qYes, qNo);
  const eYes = Math.exp((qYes - m) / b);
  const eNo = Math.exp((qNo - m) / b);
  return eYes / (eYes + eNo);
}

export function lmsrPriceNo(qYes: number, qNo: number, b: number): number {
  return 1 - lmsrPriceYes(qYes, qNo, b);
}

/**
 * Given USDC in, compute how many YES shares the buyer receives.
 * newCost - oldCost = usdcIn.  Solve for deltaQ.
 * Uses a simple bisection since LMSR cost is monotonic.
 */
export function sharesForBuyYes(
  qYes: number,
  qNo: number,
  b: number,
  usdcIn: number,
): number {
  const oldCost = lmsrCost(qYes, qNo, b);
  let lo = 0;
  let hi = Math.max(usdcIn * 10, b); // generous upper bound
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const newCost = lmsrCost(qYes + mid, qNo, b);
    if (newCost - oldCost < usdcIn) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export function sharesForBuyNo(
  qYes: number,
  qNo: number,
  b: number,
  usdcIn: number,
): number {
  const oldCost = lmsrCost(qYes, qNo, b);
  let lo = 0;
  let hi = Math.max(usdcIn * 10, b);
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const newCost = lmsrCost(qYes, qNo + mid, b);
    if (newCost - oldCost < usdcIn) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export interface TradePreview {
  shares: number;
  avgPrice: number;
  priceImpact: number; // in percent points
  newPriceYes: number;
  protocolFee: number;
  creatorFee: number;
}

const PROTOCOL_FEE_BPS = 200;
const CREATOR_FEE_BPS = 10;

export function previewBuy(
  qYes: number,
  qNo: number,
  b: number,
  usdcIn: number,
  side: "Yes" | "No",
): TradePreview {
  const protocolFee = (usdcIn * PROTOCOL_FEE_BPS) / 10_000;
  const creatorFee = (usdcIn * CREATOR_FEE_BPS) / 10_000;
  const effectiveIn = usdcIn - protocolFee - creatorFee;
  const oldPriceYes = lmsrPriceYes(qYes, qNo, b);
  let shares = 0;
  let newPriceYes = oldPriceYes;
  if (side === "Yes") {
    shares = sharesForBuyYes(qYes, qNo, b, effectiveIn);
    newPriceYes = lmsrPriceYes(qYes + shares, qNo, b);
  } else {
    shares = sharesForBuyNo(qYes, qNo, b, effectiveIn);
    newPriceYes = lmsrPriceYes(qYes, qNo + shares, b);
  }
  const avgPrice = shares > 0 ? effectiveIn / shares : side === "Yes" ? oldPriceYes : 1 - oldPriceYes;
  const priceImpact = Math.abs(newPriceYes - oldPriceYes) * 100;
  return { shares, avgPrice, priceImpact, newPriceYes, protocolFee, creatorFee };
}

/**
 * Preview a sell: user gives up `sharesIn` of `side`, receives USDC.
 * `usdcOut = C(old) - C(new)` before fees, then fees subtracted from the
 * user's take.
 */
export function previewSell(
  qYes: number,
  qNo: number,
  b: number,
  sharesIn: number,
  side: "Yes" | "No",
): TradePreview {
  const oldPriceYes = lmsrPriceYes(qYes, qNo, b);
  const oldCost = lmsrCost(qYes, qNo, b);
  let newCost: number;
  let newPriceYes: number;
  if (side === "Yes") {
    const nextQYes = Math.max(0, qYes - sharesIn);
    newCost = lmsrCost(nextQYes, qNo, b);
    newPriceYes = lmsrPriceYes(nextQYes, qNo, b);
  } else {
    const nextQNo = Math.max(0, qNo - sharesIn);
    newCost = lmsrCost(qYes, nextQNo, b);
    newPriceYes = lmsrPriceYes(qYes, nextQNo, b);
  }
  const grossOut = Math.max(0, oldCost - newCost);
  const protocolFee = (grossOut * PROTOCOL_FEE_BPS) / 10_000;
  const creatorFee = (grossOut * CREATOR_FEE_BPS) / 10_000;
  const usdcOut = grossOut - protocolFee - creatorFee;
  const avgPrice = sharesIn > 0 ? usdcOut / sharesIn : 0;
  const priceImpact = Math.abs(newPriceYes - oldPriceYes) * 100;
  return {
    shares: usdcOut, // in sell-preview, `shares` field carries USDC out for UI reuse
    avgPrice,
    priceImpact,
    newPriceYes,
    protocolFee,
    creatorFee,
  };
}

// Given initial liquidity L and b, seed qYes = qNo to reach ~50/50 price.
export function seedQuantities(initialLiquidity: number, _b: number): { qYes: number; qNo: number } {
  // With qYes = qNo = 0, cost = b * ln(2). Any deposit beyond that becomes
  // pure liquidity cushion. For UI, we just split 50/50 at q=0.
  return { qYes: 0, qNo: 0 };
}
