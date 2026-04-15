import type { APIRoute } from "astro";
import type { Address } from "viem";
import { formatUnits, getAddress } from "viem";
import type { SwapFee, SwapPrice } from "cooperative";
import type {
  ResolveTokenDetails,
  ZeroExPriceResponse,
} from "../../../types/api";
import {
  amountToUsdScaled,
  calculateBpsFromDelta,
  isValidAddress,
  stringifyWithBigInt,
} from "cooperative";
import {
  createTokenDetailsResolver,
  getSwapFee,
  parsePositiveBigInt,
  parseOptionalBps,
  validateAddress,
  validateApiKeyFromEnv,
  validateRequiredEnv,
  validateSupportedChainId,
} from "../../../utils/api";

export const prerender = false;

function isMissingAlchemyPriceError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.message.includes("Token price not available");
}

/**
 * Calculates price impact in bps by comparing token-in USD value
 * against expected token-out USD value.
 */
async function calculatePriceImpactBps(
  tokenIn: {
    chainId: number;
    address: Address;
    amount: bigint;
  },
  tokenOut: {
    chainId: number;
    address: Address;
    expectedAmount: bigint;
  },
  resolveTokenDetails: ResolveTokenDetails,
): Promise<{ bps: number; usd: bigint } | null> {
  if (tokenIn.amount === 0n || tokenOut.expectedAmount === 0n)
    return { bps: 0, usd: 0n };

  try {
    const [tokenInWithDetails, tokenOutWithDetails] = await Promise.all([
      resolveTokenDetails(tokenIn.chainId, tokenIn.address),
      resolveTokenDetails(tokenOut.chainId, tokenOut.address),
    ]);

    const tokenInAmountUsd = amountToUsdScaled(
      tokenIn.amount,
      tokenInWithDetails.fiatValue,
      tokenInWithDetails.decimals,
    );
    const tokenOutAmountUsd = amountToUsdScaled(
      tokenOut.expectedAmount,
      tokenOutWithDetails.fiatValue,
      tokenOutWithDetails.decimals,
    );

    if (tokenOutAmountUsd >= tokenInAmountUsd) return { bps: 0, usd: 0n };
    const delta = tokenInAmountUsd - tokenOutAmountUsd;
    const bps = calculateBpsFromDelta(tokenInAmountUsd, delta);
    return { bps, usd: delta };
  } catch (error) {
    if (isMissingAlchemyPriceError(error)) return null;
    throw error;
  }
}

/**
 * Calculates fee impact in bps as total fee USD over token-in USD.
 * Returns `null` when the computation fails unexpectedly.
 */
async function calculateFeeImpactBps(
  chainId: number,
  fees: SwapFee[],
  tokenIn: Address,
  tokenInAmount: bigint,
  resolveTokenDetails: ResolveTokenDetails,
): Promise<{ bps: number; usd: bigint } | null> {
  if (fees.length === 0 || tokenInAmount === 0n) return { bps: 0, usd: 0n };

  try {
    const tokenInDetails = await resolveTokenDetails(chainId, tokenIn);

    const tokenInUsd = amountToUsdScaled(
      tokenInAmount,
      tokenInDetails.fiatValue,
      tokenInDetails.decimals,
    );

    const feeUsdByToken = await Promise.all(
      fees.map(async (fee) => {
        const tokenDetails = await resolveTokenDetails(chainId, fee.token);
        return amountToUsdScaled(
          fee.amount,
          tokenDetails.fiatValue,
          tokenDetails.decimals,
        );
      }),
    );
    const totalFeeUsd = feeUsdByToken.reduce((acc, feeUsd) => acc + feeUsd, 0n);

    if (totalFeeUsd === 0n) {
      return { bps: 0, usd: 0n };
    }

    return {
      bps: calculateBpsFromDelta(tokenInUsd, totalFeeUsd),
      usd: totalFeeUsd,
    };
  } catch (error) {
    if (!isMissingAlchemyPriceError(error)) {
      console.error("Fee impact calculation failed", error);
    }
    return null;
  }
}

/**
 * GET /api/swaps/get-price
 *
 * Returns a normalized swap price payload from the 0x `allowance-holder/price` endpoint.
 * It validates request params, optionally applies platform fees, and computes
 * additional impact metrics (`priceImpactBps` and `feePriceImpact`).
 *
 * @param request - Astro request object containing query parameters.
 * @returns JSON response with the `SwapPrice` payload or an error object.
 *
 * Query parameters:
 * - `takerAddress` (required): EOA initiating the swap.
 * - `chainId` (required): Supported chain ID.
 * - `tokenIn` (required): Sell token address.
 * - `tokenOut` (required): Buy token address.
 * - `sellAmount` (required): Sell amount in tokenIn units.
 * - `recipientAddress` (optional): Receiver of buy token; defaults to `takerAddress`.
 * - `slippageBps` (optional): Max slippage in bps; defaults to `100`.
 * - `platformFeeBps` (optional): Integrator fee in bps; defaults to `0`.
 */
export const GET: APIRoute = async ({ request }) => {
  let apiKey: string;
  try {
    apiKey = validateApiKeyFromEnv("ZERO_EX_API_KEY");
  } catch {
    return new Response(
      JSON.stringify({ error: "ZERO_EX_API_KEY not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const url = new URL(request.url);
  let chainId: number;
  try {
    chainId = validateSupportedChainId(url.searchParams.get("chainId"));
  } catch {
    return new Response(
      JSON.stringify({ error: "Unsupported or invalid chainId" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  let takerAddress: Address;
  let tokenIn: Address;
  let tokenOut: Address;
  let sellAmount: bigint;
  let recipientAddress: Address;
  let slippageBps: number;
  let platformFeeBps: number;
  try {
    takerAddress = validateAddress(
      url.searchParams.get("takerAddress"),
      "takerAddress",
    );
    tokenIn = validateAddress(url.searchParams.get("tokenIn"), "tokenIn");
    tokenOut = validateAddress(url.searchParams.get("tokenOut"), "tokenOut");
    sellAmount = parsePositiveBigInt(
      url.searchParams.get("sellAmount"),
      "sellAmount",
    );
    recipientAddress = validateAddress(
      url.searchParams.get("recipientAddress") ?? takerAddress,
      "recipientAddress",
    );
    slippageBps = parseOptionalBps(
      url.searchParams.get("slippageBps"),
      "slippageBps",
      100,
    );
    platformFeeBps = parseOptionalBps(
      url.searchParams.get("platformFeeBps"),
      "platformFeeBps",
      0,
    );
  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({ error: "Invalid request parameters" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
  const resolveTokenDetails = createTokenDetailsResolver();

  const zeroExUrl = new URL(
    `${import.meta.env.ZERO_EX_API_URL}/swap/allowance-holder/price`,
  );
  zeroExUrl.searchParams.set("chainId", String(chainId));
  zeroExUrl.searchParams.set("sellToken", tokenIn);
  zeroExUrl.searchParams.set("buyToken", tokenOut);
  zeroExUrl.searchParams.set("sellAmount", sellAmount.toString());
  zeroExUrl.searchParams.set("taker", takerAddress);
  zeroExUrl.searchParams.set("recipient", recipientAddress);
  zeroExUrl.searchParams.set("slippageBps", String(slippageBps));

  if (platformFeeBps > 0) {
    let feeRecipientRaw: string;
    try {
      feeRecipientRaw = validateRequiredEnv("SWAPS_FEE_RECEIVER");
    } catch {
      return new Response(
        JSON.stringify({
          error: "SWAPS_FEE_RECEIVER not configured while platformFeeBps > 0",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }
    let feeRecipient: Address;
    try {
      feeRecipient = validateAddress(feeRecipientRaw, "SWAPS_FEE_RECEIVER");
    } catch {
      return new Response(
        JSON.stringify({ error: "SWAPS_FEE_RECEIVER is invalid" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }
    zeroExUrl.searchParams.set("swapFeeRecipient", feeRecipient);
    zeroExUrl.searchParams.set("swapFeeBps", String(platformFeeBps));
  }

  let payload: ZeroExPriceResponse;
  try {
    const zeroExResponse = await fetch(zeroExUrl, {
      method: "GET",
      headers: {
        "0x-api-key": apiKey,
        "0x-version": "v2",
      },
    });

    const zeroExBody = (await zeroExResponse.json()) as ZeroExPriceResponse;

    if (!zeroExResponse.ok) {
      console.error(zeroExResponse);
      return new Response(
        JSON.stringify({ error: "Failed to get swap price" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    if (!zeroExBody.liquidityAvailable) {
      return new Response(
        JSON.stringify({ error: "No liquidity available for this route" }),
        { status: 422, headers: { "Content-Type": "application/json" } },
      );
    }

    payload = zeroExBody;
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "Failed to get swap price" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (
    !payload.sellAmount ||
    !payload.buyAmount ||
    !payload.minBuyAmount ||
    !payload.gas ||
    !payload.gasPrice ||
    !payload.totalNetworkFee
  ) {
    console.error(
      `Failed to get swap price from 0x: ${stringifyWithBigInt(payload)}`,
    );
    return new Response(JSON.stringify({ error: "Failed to get swap price" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const allowanceTargetRaw =
    payload.allowanceTarget ?? payload.issues?.allowance?.spender;
  if (
    !allowanceTargetRaw ||
    !isValidAddress(allowanceTargetRaw, { strict: false })
  ) {
    return new Response(
      JSON.stringify({ error: "Failed to resolve allowance target" }),
      {
        status: 502,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
  const allowanceTarget = getAddress(allowanceTargetRaw);

  const fees: SwapFee[] = [];

  try {
    const [integratorFee, zeroExFee, gasFee] = await Promise.all([
      getSwapFee(
        chainId,
        payload.fees?.integratorFee,
        "platform",
        resolveTokenDetails,
      ),
      getSwapFee(
        chainId,
        payload.fees?.zeroExFee,
        "tools",
        resolveTokenDetails,
      ),
      getSwapFee(chainId, payload.fees?.gasFee, "gas", resolveTokenDetails),
    ]);
    if (integratorFee) fees.push(integratorFee);
    if (zeroExFee) fees.push(zeroExFee);
    if (gasFee) fees.push(gasFee);
  } catch (error) {
    console.error(error);
  }

  const tokenInAmount = BigInt(payload.sellAmount);
  let tokenInFiatValue = "0";
  const expectedBuyAmount = BigInt(payload.buyAmount);
  const minBuyAmount = BigInt(payload.minBuyAmount);
  let expectedTokenOutFiatValue = "0";
  let minTokenOutFiatValue = "0";
  let priceImpactBps: number | null = null;
  let priceImpactUsd: string | null = null;
  let feeImpactBps: number | null = null;
  let feeImpactUsd: string | null = null;
  let swapImpactBps: number | null = null;
  let swapImpactUsd: string | null = null;

  try {
    const [tokenInDetails, tokenOutDetails] = await Promise.all([
      resolveTokenDetails(chainId, tokenIn),
      resolveTokenDetails(chainId, tokenOut),
    ]);
    tokenInFiatValue = formatUnits(
      amountToUsdScaled(
        tokenInAmount,
        tokenInDetails.fiatValue,
        tokenInDetails.decimals,
      ),
      18,
    );
    expectedTokenOutFiatValue = formatUnits(
      amountToUsdScaled(
        expectedBuyAmount,
        tokenOutDetails.fiatValue,
        tokenOutDetails.decimals,
      ),
      18,
    );
    minTokenOutFiatValue = formatUnits(
      amountToUsdScaled(
        minBuyAmount,
        tokenOutDetails.fiatValue,
        tokenOutDetails.decimals,
      ),
      18,
    );
  } catch (error) {
    if (!isMissingAlchemyPriceError(error)) {
      console.error("Token fiat value calculation failed", error);
    }
  }

  try {
    const [priceImpactResult, feeImpactResult] = await Promise.all([
      calculatePriceImpactBps(
        { chainId, address: tokenIn, amount: tokenInAmount },
        { chainId, address: tokenOut, expectedAmount: expectedBuyAmount },
        resolveTokenDetails,
      ),
      calculateFeeImpactBps(
        chainId,
        fees,
        tokenIn,
        tokenInAmount,
        resolveTokenDetails,
      ),
    ]);
    const totalImpactBps = priceImpactResult?.bps ?? null;
    const totalImpactUsd = priceImpactResult?.usd ?? null;
    const totalFeeImpactBps = feeImpactResult?.bps ?? null;
    const totalFeeImpactUsd = feeImpactResult?.usd ?? null;

    priceImpactBps = totalImpactBps;
    priceImpactUsd =
      totalImpactUsd !== null ? formatUnits(totalImpactUsd, 18) : null;
    feeImpactBps = totalFeeImpactBps;
    feeImpactUsd =
      totalFeeImpactUsd !== null ? formatUnits(totalFeeImpactUsd, 18) : null;

    swapImpactBps =
      totalImpactBps !== null && totalFeeImpactBps !== null
        ? Math.max(totalImpactBps - totalFeeImpactBps, 0)
        : null;
    swapImpactUsd =
      totalImpactUsd !== null && totalFeeImpactUsd !== null
        ? formatUnits(
            totalImpactUsd >= totalFeeImpactUsd
              ? totalImpactUsd - totalFeeImpactUsd
              : 0n,
            18,
          )
        : null;
  } catch (error) {
    console.error(error);
    priceImpactBps = null;
    priceImpactUsd = null;
    feeImpactBps = null;
    feeImpactUsd = null;
    swapImpactBps = null;
    swapImpactUsd = null;
  }

  const swapPrice: SwapPrice = {
    liquidityAvailable: payload.liquidityAvailable,
    blockNumber: Number(payload.blockNumber),
    gas: BigInt(payload.gas),
    gasPrice: BigInt(payload.gasPrice),
    totalNetworkFee: BigInt(payload.totalNetworkFee),
    takerAddress,
    recipientAddress,
    tokenIn: {
      address: tokenIn,
      amount: tokenInAmount,
      fiatValue: tokenInFiatValue,
    },
    tokenOut: {
      address: tokenOut,
      expectedAmount: expectedBuyAmount,
      expectedFiatValue: expectedTokenOutFiatValue,
      minAmount: minBuyAmount,
      minFiatValue: minTokenOutFiatValue,
    },
    fees,
    priceImpactBps,
    priceImpactUsd,
    feePriceImpact: feeImpactBps,
    feePriceImpactUsd: feeImpactUsd,
    swapPriceImpact: swapImpactBps,
    swapPriceImpactUsd: swapImpactUsd,
    slippageBps,
    allowanceTarget,
  };

  return new Response(stringifyWithBigInt(swapPrice), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
