import type { Address } from "viem";
import { SUPPORTED_CHAIN_IDS } from "../constants";
import type { Network, TokenWithChainId } from "../types";
import { isValidAddress } from "../utils";

export interface RetrieveUniswapTokensOptions {
  addresses?: readonly Address[];
  chainId?: Network["chainId"];
  symbol?: string;
  name?: string;
}

/**
 * Fetches the Uniswap default token list (filtered to app-supported chains) via
 * `GET /api/tokens/uniswap-tokens`, with optional server-side filters.
 *
 * @param options - Optional filters. When omitted, returns the full supported list.
 * @returns Parsed `tokens` array from the API response.
 * @throws {Error} When `chainId` is not supported, any address filter is invalid, the
 *   response is malformed, or the request fails.
 */
export async function retrieveUniswapTokens(
  options?: RetrieveUniswapTokensOptions,
): Promise<TokenWithChainId[]> {
  if (
    options?.chainId !== undefined &&
    !SUPPORTED_CHAIN_IDS.includes(options.chainId)
  ) {
    throw new Error("Unsupported chainId");
  }

  const params = new URLSearchParams();
  if (options?.addresses?.length) {
    for (const addr of options.addresses) {
      if (!isValidAddress(addr, { allowNative: true, strict: false })) {
        throw new Error("Invalid token address in addresses filter");
      }
      params.append("address", addr);
    }
  }
  if (options?.chainId !== undefined) {
    params.set("chainId", String(options.chainId));
  }
  if (options?.symbol?.trim()) {
    params.set("symbol", options.symbol.trim());
  }
  if (options?.name?.trim()) {
    params.set("name", options.name.trim());
  }

  const baseUrl = import.meta.env.PUBLIC_API_URL;
  const query = params.toString();
  const url = query
    ? `${baseUrl}/tokens/uniswap-tokens?${query}`
    : `${baseUrl}/tokens/uniswap-tokens`;

  const response = await fetch(url);
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      typeof (error as { error?: string }).error === "string"
        ? (error as { error: string }).error
        : "Failed to fetch Uniswap token list",
    );
  }

  const body = (await response.json()) as { tokens?: unknown };
  if (!Array.isArray(body.tokens)) {
    throw new Error("Invalid response shape from Uniswap tokens API");
  }

  return body.tokens as TokenWithChainId[];
}
