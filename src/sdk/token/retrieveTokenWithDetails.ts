import type { Address } from "viem";
import { SUPPORTED_CHAIN_IDS } from "../constants";
import type { Network, TokenWithDetails } from "../types";
import { isValidAddress } from "../utils";

/**
 * Fetches token metadata, logo and fiat quote via `GET /api/token/:chainId/:address`
 * (Alchemy metadata + Prices API on the server).
 *
 * @param chainId - Supported EVM chain ID (1, 8453, 137).
 * @param address - Contract address (checksum or lowercase) or the native placeholder
 *   `0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE` for the chain gas token.
 * @returns {@link TokenWithDetails} JSON body from the API.
 * @throws {Error} When `chainId` is unsupported, `address` is invalid, or the request fails.
 */
export async function retrieveTokenWithDetails(
  chainId: Network["chainId"],
  address: Address,
): Promise<TokenWithDetails> {
  if (!SUPPORTED_CHAIN_IDS.includes(chainId)) {
    throw new Error("Unsupported chainId");
  }
  if (!isValidAddress(address, { allowNative: true, strict: false })) {
    throw new Error("Invalid token address");
  }

  const baseUrl = import.meta.env.PUBLIC_API_URL ?? "/api";
  const url = `${baseUrl}/token/${chainId}/${encodeURIComponent(address)}`;

  const response = await fetch(url);
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      typeof (error as { error?: string }).error === "string"
        ? (error as { error: string }).error
        : `Failed to fetch token (${response.status})`,
    );
  }

  return (await response.json()) as TokenWithDetails;
}
