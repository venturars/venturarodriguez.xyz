import type { Address } from "viem";
import type { Network, TokenWithBalance } from "../types";
import { isValidAddress } from "../utils";
import { SUPPORTED_CHAIN_IDS } from "../constants";

export interface RetrieveTokensWithBalanceOptions {
  networks?: Network["chainId"][];
}

interface TokenWithBalanceJSON extends Omit<TokenWithBalance, "balance"> {
  balance: string;
}

function isValidNetworks(networks: Network["chainId"][]): boolean {
  return (
    networks.length > 0 &&
    networks.every((id) => SUPPORTED_CHAIN_IDS.includes(id))
  );
}

/**
 * Fetches fungible tokens (native and ERC-20) with balances and metadata for a wallet
 * address across one or more networks.
 *
 * @param address - The wallet address (Ethereum checksum format).
 * @param options - Optional configuration for the request.
 * @param options.networks - Chain IDs to query. Defaults to all supported networks
 *   when omitted. Supported: 1 (Ethereum), 8453 (Base), 137 (Polygon).
 * @returns A promise that resolves to an array of {@link TokenWithBalance} objects,
 *   filtered to tokens with non-zero balance.
 * @throws {Error} When the address is invalid.
 * @throws {Error} When networks contains unsupported chain IDs.
 * @throws {Error} When the API request fails.
 *
 * @example
 * ```ts
 * const tokens = await retrieveTokensWithBalance("0x1234...", {
 *   networks: [1, 8453, 137],
 * });
 * ```
 */
export async function retrieveTokensWithBalance(
  address: Address,
  options?: RetrieveTokensWithBalanceOptions,
): Promise<TokenWithBalance[]> {
  if (!isValidAddress(address)) {
    throw new Error("Valid wallet address is required");
  }
  if (options?.networks && !isValidNetworks(options.networks)) {
    throw new Error(
      "Invalid networks parameter: must be a non-empty array of supported chain IDs",
    );
  }

  const params = new URLSearchParams({ address });
  if (options?.networks?.length) {
    params.set("networks", JSON.stringify(options.networks));
  }

  const baseUrl = import.meta.env.PUBLIC_API_URL ?? "/api";
  const url = `${baseUrl}/user/tokens?${params}`;

  const response = await fetch(url);
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error?.error ?? "Failed to fetch tokens");
  }

  const tokens: TokenWithBalanceJSON[] = await response.json();
  return tokens.map((t) => ({
    ...t,
    balance: BigInt(t.balance),
  })) as TokenWithBalance[];
}
