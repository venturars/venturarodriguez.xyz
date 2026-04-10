import { sendTransaction } from "@wagmi/core";
import { isHex } from "viem";
import { wagmiConfig } from "../../../libs/appkit";
import { SUPPORTED_CHAIN_IDS } from "../../constants";
import type { Network, QuotePrice } from "../../types";
import { isValidAddress } from "../../utils";

/**
 * Sends the quote transaction through the connected wallet.
 *
 * @param chainId - Active chain id where the swap will be executed.
 * @param quote - Final firm quote returned by `getQuote`.
 * @returns Submitted transaction hash.
 * @throws Error When quote fields are invalid or chain is unsupported.
 */
export async function submitQuoteTransaction(
  chainId: Network["chainId"],
  quote: QuotePrice,
): Promise<`0x${string}`> {
  if (!SUPPORTED_CHAIN_IDS.includes(chainId))
    throw new Error("Unsupported chainId");

  if (!isValidAddress(quote.transaction.to, { strict: false }))
    throw new Error("Invalid quote transaction target");

  if (!isHex(quote.transaction.data, { strict: true }))
    throw new Error("Invalid quote transaction calldata");

  if (quote.transaction.value < 0n)
    throw new Error("Invalid quote transaction value");

  if (quote.transaction.gas <= 0n)
    throw new Error("Invalid quote transaction gas");

  if (quote.transaction.gasPrice <= 0n)
    throw new Error("Invalid quote transaction gasPrice");

  return sendTransaction(wagmiConfig, {
    chainId,
    to: quote.transaction.to,
    data: quote.transaction.data,
    value: quote.transaction.value,
    gas: quote.transaction.gas,
    gasPrice: quote.transaction.gasPrice,
  });
}
