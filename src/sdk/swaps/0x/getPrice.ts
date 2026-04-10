import type { Address } from "viem";
import { SUPPORTED_CHAIN_IDS } from "../../constants";
import type { Network, SwapPrice } from "../../types";
import { isValidAddress, isValidBps } from "../../utils";

export interface GetSwapPriceParams {
  takerAddress: Address;
  chainId: Network["chainId"];
  tokenIn: Address;
  tokenOut: Address;
  sellAmount: bigint;
  recipientAddress?: Address;
  slippageBps?: number;
  platformFeeBps?: number;
}

interface SwapPriceJson extends Omit<
  SwapPrice,
  "gas" | "gasPrice" | "totalNetworkFee" | "tokenIn" | "tokenOut" | "fees"
> {
  gas: string;
  gasPrice: string;
  totalNetworkFee: string;
  tokenIn: {
    address: Address;
    amount: string;
    fiatValue: string;
  };
  tokenOut: {
    address: Address;
    expectedAmount: string;
    expectedFiatValue: string;
    minAmount: string;
    minFiatValue: string;
  };
  fees: Array<{
    type: "tools" | "platform" | "gas";
    token: Address;
    amount: string;
    amountUsd: string;
  }>;
}

/**
 * Fetches a swap price quote from the backend API and normalizes numeric fields to bigint.
 *
 * @param params - Quote request values including chain, tokens and sell amount.
 * @returns Parsed swap price with bigint values for gas, amounts and fees.
 * @throws Error When any input is invalid.
 * @throws Error When the API request fails or returns a non-OK response.
 */
export async function getPrice(params: GetSwapPriceParams): Promise<SwapPrice> {
  const {
    takerAddress,
    chainId,
    tokenIn,
    tokenOut,
    sellAmount,
    recipientAddress,
    slippageBps = 100,
    platformFeeBps = 0,
  } = params;

  if (!SUPPORTED_CHAIN_IDS.includes(chainId))
    throw new Error("Invalid chainId");

  if (!isValidAddress(takerAddress)) throw new Error("Invalid takerAddress");

  if (!isValidAddress(tokenIn, { strict: false }))
    throw new Error("Invalid tokenIn");

  if (!isValidAddress(tokenOut, { strict: false }))
    throw new Error("Invalid tokenOut");

  if (tokenIn.toLowerCase() === tokenOut.toLowerCase())
    throw new Error("tokenIn and tokenOut cannot be the same");

  if (sellAmount <= 0n) throw new Error("Invalid sellAmount");

  if (
    recipientAddress !== undefined &&
    !isValidAddress(recipientAddress, { strict: false })
  )
    throw new Error("Invalid recipientAddress");

  if (!isValidBps(slippageBps))
    throw new Error("slippageBps must be an integer between 0 and 10000");

  if (!isValidBps(platformFeeBps))
    throw new Error("platformFeeBps must be an integer between 0 and 10000");

  const searchParams = new URLSearchParams({
    takerAddress,
    chainId: String(chainId),
    tokenIn,
    tokenOut,
    sellAmount: sellAmount.toString(),
  });

  if (recipientAddress) searchParams.set("recipientAddress", recipientAddress);

  if (slippageBps !== undefined)
    searchParams.set("slippageBps", String(slippageBps));

  if (platformFeeBps !== undefined)
    searchParams.set("platformFeeBps", String(platformFeeBps));

  const url = `${import.meta.env.PUBLIC_API_URL}/swaps/get-price?${searchParams.toString()}`;

  const response = await fetch(url);
  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new Error(error.error ?? "Failed to fetch swap price");
  }

  const payload = (await response.json()) as SwapPriceJson;
  return {
    ...payload,
    gas: BigInt(payload.gas),
    gasPrice: BigInt(payload.gasPrice),
    totalNetworkFee: BigInt(payload.totalNetworkFee),
    tokenIn: {
      ...payload.tokenIn,
      amount: BigInt(payload.tokenIn.amount),
    },
    tokenOut: {
      ...payload.tokenOut,
      expectedAmount: BigInt(payload.tokenOut.expectedAmount),
      minAmount: BigInt(payload.tokenOut.minAmount),
    },
    fees: payload.fees.map((fee) => ({
      ...fee,
      amount: BigInt(fee.amount),
    })),
  };
}
