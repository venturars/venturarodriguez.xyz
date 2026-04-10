import type { QuotePrice, SwapPrice } from "../../types";

export interface QuoteAcceptabilityTolerance {
  maxExpectedAmountDropBps: number;
  maxMinAmountDropBps: number;
  maxFeeIncreaseBps: number;
  maxGasIncreaseBps: number;
  maxGasPriceIncreaseBps: number;
  maxBlockDrift: number;
  allowSimulationIncomplete: boolean;
}

export interface QuoteAcceptabilityMetrics {
  expectedAmountDropBps: number;
  minAmountDropBps: number;
  maxFeeIncreaseBps: number;
  gasIncreaseBps: number;
  gasPriceIncreaseBps: number;
  blockDrift: number;
}

export interface QuoteAcceptabilityResult {
  acceptable: boolean;
  reasons: string[];
  metrics: QuoteAcceptabilityMetrics;
}

export const DEFAULT_QUOTE_ACCEPTABILITY_TOLERANCE: QuoteAcceptabilityTolerance =
  {
    maxExpectedAmountDropBps: 50, // 0.50%
    maxMinAmountDropBps: 100, // 1.00%
    maxFeeIncreaseBps: 100, // 1.00%
    maxGasIncreaseBps: 2500, // 25.00%
    maxGasPriceIncreaseBps: 3000, // 30.00%
    maxBlockDrift: 5,
    allowSimulationIncomplete: false,
  };

function calculateDropBps(reference: bigint, current: bigint): number {
  if (reference <= 0n) return current <= 0n ? 0 : 10_000;
  if (current >= reference) return 0;
  return Number(((reference - current) * 10_000n) / reference);
}

function calculateIncreaseBps(reference: bigint, current: bigint): number {
  if (reference <= 0n) return current <= 0n ? 0 : 10_000;
  if (current <= reference) return 0;
  return Number(((current - reference) * 10_000n) / reference);
}

function getFeeKey(fee: { type: string; token: string }): string {
  return `${fee.type}:${fee.token.toLowerCase()}`;
}

/**
 * Compares an indicative `SwapPrice` against the final `QuotePrice`.
 * Use this right before sending the transaction to decide whether to continue.
 */
export function validateQuoteAgainstPrice(
  price: SwapPrice,
  quote: QuotePrice,
  toleranceOverrides: Partial<QuoteAcceptabilityTolerance> = {},
): QuoteAcceptabilityResult {
  const tolerance: QuoteAcceptabilityTolerance = {
    ...DEFAULT_QUOTE_ACCEPTABILITY_TOLERANCE,
    ...toleranceOverrides,
  };
  const reasons: string[] = [];

  if (!price.liquidityAvailable || !quote.liquidityAvailable)
    reasons.push("Liquidity is not available");

  if (
    price.allowanceTarget.toLowerCase() !== quote.allowanceTarget.toLowerCase()
  )
    reasons.push("Allowance target changed between price and quote");

  if (
    price.tokenIn.address.toLowerCase() !== quote.tokenIn.address.toLowerCase()
  )
    reasons.push("tokenIn address changed between price and quote");

  if (
    price.tokenOut.address.toLowerCase() !==
    quote.tokenOut.address.toLowerCase()
  )
    reasons.push("tokenOut address changed between price and quote");

  if (price.tokenIn.amount !== quote.tokenIn.amount)
    reasons.push("tokenIn amount changed between price and quote");

  if (quote.simulationIncomplete && !tolerance.allowSimulationIncomplete)
    reasons.push("Quote simulation is incomplete");

  const blockDrift = Math.abs(quote.blockNumber - price.blockNumber);
  if (blockDrift > tolerance.maxBlockDrift)
    reasons.push(
      `Block drift too high: ${blockDrift} > ${tolerance.maxBlockDrift}`,
    );

  const expectedAmountDropBps = calculateDropBps(
    price.tokenOut.expectedAmount,
    quote.tokenOut.expectedAmount,
  );
  if (expectedAmountDropBps > tolerance.maxExpectedAmountDropBps)
    reasons.push(
      `Expected output dropped too much: ${expectedAmountDropBps} bps > ${tolerance.maxExpectedAmountDropBps} bps`,
    );

  const minAmountDropBps = calculateDropBps(
    price.tokenOut.minAmount,
    quote.tokenOut.minAmount,
  );
  if (minAmountDropBps > tolerance.maxMinAmountDropBps)
    reasons.push(
      `Minimum output dropped too much: ${minAmountDropBps} bps > ${tolerance.maxMinAmountDropBps} bps`,
    );

  const gasIncreaseBps = calculateIncreaseBps(price.gas, quote.transaction.gas);
  if (gasIncreaseBps > tolerance.maxGasIncreaseBps)
    reasons.push(
      `Estimated gas increased too much: ${gasIncreaseBps} bps > ${tolerance.maxGasIncreaseBps} bps`,
    );

  const gasPriceIncreaseBps = calculateIncreaseBps(
    price.gasPrice,
    quote.transaction.gasPrice,
  );
  if (gasPriceIncreaseBps > tolerance.maxGasPriceIncreaseBps)
    reasons.push(
      `Gas price increased too much: ${gasPriceIncreaseBps} bps > ${tolerance.maxGasPriceIncreaseBps} bps`,
    );

  const priceFees = new Map(price.fees.map((fee) => [getFeeKey(fee), fee]));
  const quoteFees = new Map(quote.fees.map((fee) => [getFeeKey(fee), fee]));
  const allFeeKeys = new Set([...priceFees.keys(), ...quoteFees.keys()]);
  let maxFeeIncreaseBps = 0;

  for (const key of allFeeKeys) {
    const priceFee = priceFees.get(key);
    const quoteFee = quoteFees.get(key);
    if (!priceFee || !quoteFee) {
      reasons.push("Fee structure changed between price and quote");
      continue;
    }
    const feeIncreaseBps = calculateIncreaseBps(
      priceFee.amount,
      quoteFee.amount,
    );
    maxFeeIncreaseBps = Math.max(maxFeeIncreaseBps, feeIncreaseBps);
  }

  if (maxFeeIncreaseBps > tolerance.maxFeeIncreaseBps)
    reasons.push(
      `Fees increased too much: ${maxFeeIncreaseBps} bps > ${tolerance.maxFeeIncreaseBps} bps`,
    );

  return {
    acceptable: reasons.length === 0,
    reasons,
    metrics: {
      expectedAmountDropBps,
      minAmountDropBps,
      maxFeeIncreaseBps,
      gasIncreaseBps,
      gasPriceIncreaseBps,
      blockDrift,
    },
  };
}
