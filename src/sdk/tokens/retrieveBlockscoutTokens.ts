import { SUPPORTED_CHAIN_IDS } from "../constants";
import type { Network, TokenWithChainId } from "../types";

const MIN_ITEMS_COUNT = 1;
const MAX_ITEMS_COUNT = 50;

export interface RetrieveBlockscoutTokensOptions {
  chainId: Network["chainId"];
  q?: string;
  itemsCount?: number;
}

/**
 * Fetches ERC-20 tokens from Blockscout via `GET /api/tokens/blockscout-tokens`.
 *
 * @param options - Required chain and optional search/pagination query.
 * @returns Parsed `tokens` array from the API response.
 * @throws {Error} When `chainId` is unsupported, `itemsCount` is invalid,
 *   the response shape is malformed, or the request fails.
 */
export async function retrieveBlockscoutTokens(
  options: RetrieveBlockscoutTokensOptions,
): Promise<TokenWithChainId[]> {
  if (!SUPPORTED_CHAIN_IDS.includes(options.chainId))
    throw new Error("Unsupported chainId");

  if (
    options.itemsCount !== undefined &&
    (!Number.isInteger(options.itemsCount) ||
      options.itemsCount < MIN_ITEMS_COUNT ||
      options.itemsCount > MAX_ITEMS_COUNT)
  )
    throw new Error(
      `itemsCount must be an integer between ${MIN_ITEMS_COUNT} and ${MAX_ITEMS_COUNT}`,
    );

  const params = new URLSearchParams();
  params.set("chainId", String(options.chainId));
  if (options.q?.trim()) params.set("q", options.q.trim());
  if (options.itemsCount !== undefined)
    params.set("itemsCount", String(options.itemsCount));

  const baseUrl = import.meta.env.PUBLIC_API_URL;
  const url = `${baseUrl}/tokens/blockscout-tokens?${params.toString()}`;

  const response = await fetch(url);
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      typeof (error as { error?: string }).error === "string"
        ? (error as { error: string }).error
        : "Failed to fetch Blockscout tokens",
    );
  }

  const body = (await response.json()) as { tokens?: unknown };
  if (!Array.isArray(body.tokens)) {
    throw new Error("Invalid response shape from Blockscout tokens API");
  }

  return body.tokens as TokenWithChainId[];
}
