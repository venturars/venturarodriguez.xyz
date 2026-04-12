import type { Address } from "viem";
import { retrieveTokenWithDetails } from "../token/retrieveTokenWithDetails";
import { retrieveBlockscoutTokens } from "../tokens/retrieveBlockscoutTokens";
import type { Network, TokenWithChainId, TokenWithBalance } from "../types";
import { retrieveTokensWithBalance } from "../user/retrieveTokensWithBalance";
import { isValidAddress } from "../utils";
import { SUPPORTED_CHAIN_IDS } from "../constants";

type SearchSelectorEmptyQueryMode = "balances" | "top10";

const BLOCKSCOUT_PREVIEW_COUNT = 20;

export interface SearchSelectorTokensParams {
  walletAddress: Address;
  chainId: Network["chainId"];
  query: string;
  emptyQueryMode?: SearchSelectorEmptyQueryMode;
}

/**
 * Data for the token selector modal: combines wallet balances, Blockscout token list
 * search, and single-token resolution by contract address. Rows are {@link TokenWithChainId} or {@link TokenWithBalance};
 *
 * - Empty query → see {@link SearchSelectorTokensParams.emptyQueryMode}: wallet balances (default) or Blockscout preview slice.
 * - Query that is a valid token address (incl. native sentinel) → one row from
 *   {@link retrieveTokenWithDetails} or empty if the API errors.
 * - Otherwise → Blockscout list for `chainId` filtered by query; rows with wallet balance
 *   come first; then wallet tokens that match the query but are not on that Blockscout
 *   slice; then remaining Blockscout matches.
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
        const list = await retrieveBlockscoutTokens({
          chainId,
          itemsCount: BLOCKSCOUT_PREVIEW_COUNT,
        });
        return list.slice(0, BLOCKSCOUT_PREVIEW_COUNT);
      } catch {
        throw new Error("Failed to load Blockscout token list");
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
    const [balanceTokens, blockscoutList] = await Promise.all([
      retrieveTokensWithBalance(walletAddress, { networks: [chainId] }),
      retrieveBlockscoutTokens({ chainId, q }),
    ]);

    const held = new Set(balanceTokens.map((t) => addrKey(t.address)));
    const blockscoutMatching = blockscoutList.filter(matchesQuery);
    const blockscoutMatchKeys = new Set(
      blockscoutMatching.map((t) => addrKey(t.address)),
    );

    const blockscoutHeld = blockscoutMatching.filter((t) =>
      held.has(addrKey(t.address)),
    );
    const blockscoutNotHeld = blockscoutMatching.filter(
      (t) => !held.has(addrKey(t.address)),
    );

    const balanceOnlyMatching = balanceTokens.filter(
      (b) => matchesQuery(b) && !blockscoutMatchKeys.has(addrKey(b.address)),
    );

    return [...blockscoutHeld, ...balanceOnlyMatching, ...blockscoutNotHeld];
  } catch {
    throw new Error(
      "Failed to retrieve tokens with balance or Blockscout list",
    );
  }
}
