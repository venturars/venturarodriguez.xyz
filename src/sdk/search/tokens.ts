import type { Address } from "viem";
import { retrieveTokenWithDetails } from "../token/retrieveTokenWithDetails";
import { retrieveUniswapTokens } from "../tokens/retrieveUniswapTokens";
import type { Network, TokenWithChainId, TokenWithBalance } from "../types";
import { retrieveTokensWithBalance } from "../user/retrieveTokensWithBalance";
import { isValidAddress } from "../utils";
import { SUPPORTED_CHAIN_IDS } from "../constants";

type SearchSelectorEmptyQueryMode = "balances" | "top10";

const UNISWAP_PREVIEW_COUNT = 10;

export interface SearchSelectorTokensParams {
  walletAddress: Address;
  chainId: Network["chainId"];
  query: string;
  emptyQueryMode?: SearchSelectorEmptyQueryMode;
}

/**
 * Data for the token selector modal: combines wallet balances, Uniswap default list
 * search, and single-token resolution by contract address. Rows are {@link TokenWithChainId} or {@link TokenWithBalance};
 *
 * - Empty query → see {@link SearchSelectorTokensParams.emptyQueryMode}: wallet balances (default) or Uniswap preview slice.
 * - Query that is a valid token address (incl. native sentinel) → one row from
 *   {@link retrieveTokenWithDetails} or empty if the API errors.
 * - Otherwise → Uniswap list for `chainId` filtered by query; rows with wallet balance
 *   come first; then wallet tokens that match the query but are not on that Uniswap
 *   slice; then remaining Uniswap matches.
 */
export async function searchSelectorTokens(
  params: SearchSelectorTokensParams,
): Promise<(TokenWithChainId | TokenWithBalance)[]> {
  const { walletAddress, chainId, query, emptyQueryMode = "top10" } = params;

  if (!SUPPORTED_CHAIN_IDS.includes(chainId))
    throw new Error("Invalid chain ID");

  const q = query.trim();

  if (q === "") {
    if (emptyQueryMode === "top10") {
      try {
        const list = await retrieveUniswapTokens({ chainId });
        return list.slice(0, UNISWAP_PREVIEW_COUNT);
      } catch {
        throw new Error("Failed to load Uniswap token list");
      }
    }

    if (!isValidAddress(walletAddress))
      throw new Error("Invalid wallet address");
    try {
      return await retrieveTokensWithBalance(walletAddress, {
        networks: [chainId],
      });
    } catch {
      throw new Error("Failed to retrieve tokens with balance");
    }
  }

  if (!isValidAddress(walletAddress)) throw new Error("Invalid wallet address");

  if (isValidAddress(q, { allowNative: true, strict: false })) {
    try {
      const token = await retrieveTokenWithDetails(chainId, q as Address);
      return [token];
    } catch {
      throw new Error("Failed to retrieve token details");
    }
  }

  const needle = q.toLowerCase();

  function matchesQuery(t: {
    symbol: string;
    name: string;
    address: string;
  }): boolean {
    return (
      t.symbol.toLowerCase().includes(needle) ||
      t.name.toLowerCase().includes(needle) ||
      t.address.toLowerCase().includes(needle)
    );
  }

  const addrKey = (a: string) => a.toLowerCase();

  try {
    const [balanceTokens, uniswapList] = await Promise.all([
      retrieveTokensWithBalance(walletAddress, { networks: [chainId] }),
      retrieveUniswapTokens({ chainId }),
    ]);

    const held = new Set(balanceTokens.map((t) => addrKey(t.address)));
    const uniswapMatching = uniswapList.filter(matchesQuery);
    const uniswapMatchKeys = new Set(
      uniswapMatching.map((t) => addrKey(t.address)),
    );

    const uniswapHeld = uniswapMatching.filter((t) =>
      held.has(addrKey(t.address)),
    );
    const uniswapNotHeld = uniswapMatching.filter(
      (t) => !held.has(addrKey(t.address)),
    );

    const balanceOnlyMatching = balanceTokens.filter(
      (b) => matchesQuery(b) && !uniswapMatchKeys.has(addrKey(b.address)),
    );

    return [...uniswapHeld, ...balanceOnlyMatching, ...uniswapNotHeld];
  } catch {
    throw new Error("Failed to retrieve tokens with balance or Uniswap list");
  }
}
