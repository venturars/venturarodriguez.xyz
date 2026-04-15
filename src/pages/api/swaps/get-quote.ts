import type { APIRoute } from "astro";
import type { Address, Hex } from "viem";
import { formatUnits, getAddress, isHex } from "viem";
import type { QuotePrice, SwapFee } from "cooperative";
import type { ZeroExQuoteResponse } from "../../../types/api";
import {
  amountToUsdScaled,
  isValidAddress,
  stringifyWithBigInt,
} from "cooperative";
import {
  createTokenDetailsResolver,
  getSwapFee,
  parseOptionalBps,
  parsePositiveBigInt,
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
 * GET /api/swaps/get-quote
 *
 * Returns a normalized swap quote payload from 0x `allowance-holder/quote`.
 */
export const GET: APIRoute = async ({ request }) => {
  let apiKey: string;
  try {
    apiKey = validateApiKeyFromEnv("ZERO_EX_API_KEY");
  } catch {
    return new Response(
      JSON.stringify({ error: "ZERO_EX_API_KEY not configured" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const url = new URL(request.url);
  let chainId: number;
  try {
    chainId = validateSupportedChainId(url.searchParams.get("chainId"));
  } catch {
    return new Response(
      JSON.stringify({ error: "Unsupported or invalid chainId" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
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
  } catch (error) {
    console.error(error);
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
    `${import.meta.env.ZERO_EX_API_URL}/swap/allowance-holder/quote`,
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
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
    zeroExUrl.searchParams.set("swapFeeRecipient", feeRecipient);
    zeroExUrl.searchParams.set("swapFeeBps", String(platformFeeBps));
  }

  let payload: ZeroExQuoteResponse;
  try {
    const zeroExResponse = await fetch(zeroExUrl, {
      method: "GET",
      headers: {
        "0x-api-key": apiKey,
        "0x-version": "v2",
      },
    });
    const zeroExBody = (await zeroExResponse.json()) as ZeroExQuoteResponse;

    if (!zeroExResponse.ok) {
      console.error(zeroExBody);
      return new Response(
        JSON.stringify({ error: "Failed to get swap quote" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    if (!zeroExBody.liquidityAvailable) {
      return new Response(
        JSON.stringify({ error: "No liquidity available for this route" }),
        {
          status: 422,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    payload = zeroExBody;
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: "Failed to get swap quote" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (
    !payload.sellAmount ||
    !payload.buyAmount ||
    !payload.minBuyAmount ||
    !payload.blockNumber
  ) {
    console.error(
      `Incomplete quote payload from 0x: ${stringifyWithBigInt(payload)}`,
    );
    return new Response(JSON.stringify({ error: "Failed to get swap quote" }), {
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

  const transactionToRaw = payload.transaction?.to;
  const transactionTo =
    transactionToRaw && isValidAddress(transactionToRaw, { strict: false })
      ? getAddress(transactionToRaw)
      : null;
  const transactionDataRaw = payload.transaction?.data;
  const transactionData =
    transactionDataRaw && isHex(transactionDataRaw, { strict: true })
      ? (transactionDataRaw as Hex)
      : null;
  const txGasPriceRaw = payload.transaction?.gasPrice ?? payload.gasPrice;
  const txValueRaw = payload.transaction?.value;
  const txGasRaw = payload.transaction?.gas ?? payload.gas;
  if (
    !transactionTo ||
    !transactionData ||
    !txGasPriceRaw ||
    !txValueRaw ||
    !txGasRaw
  ) {
    console.error(
      `Incomplete transaction payload from 0x: ${stringifyWithBigInt(payload.transaction)}`,
    );
    return new Response(
      JSON.stringify({ error: "Failed to build swap transaction" }),
      {
        status: 502,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

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
  const expectedBuyAmount = BigInt(payload.buyAmount);
  const minBuyAmount = BigInt(payload.minBuyAmount);
  let tokenInFiatValue = "0";
  let expectedTokenOutFiatValue = "0";
  let minTokenOutFiatValue = "0";

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

  const quotePrice: QuotePrice = {
    allowanceTarget,
    blockNumber: Number(payload.blockNumber),
    simulationIncomplete: Boolean(payload.issues?.simulationIncomplete),
    liquidityAvailable: payload.liquidityAvailable,
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
    transaction: {
      to: transactionTo,
      data: transactionData,
      value: BigInt(txValueRaw),
      gas: BigInt(txGasRaw),
      gasPrice: BigInt(txGasPriceRaw),
    },
  };

  return new Response(stringifyWithBigInt(quotePrice), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
