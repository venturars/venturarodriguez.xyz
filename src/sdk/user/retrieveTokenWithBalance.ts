import type { Address } from "viem";
import type { Network, TokenWithBalance } from "../types";
import { NATIVE_TOKEN_ADDRESS, SUPPORTED_CHAIN_IDS } from "../constants";
import { retrieveTokensWithBalance } from "./retrieveTokensWithBalance";
import { isValidAddress } from "../utils";

export interface RetrieveTokenWithBalanceParams {
  walletAddress: Address;
  chainId: Network["chainId"];
  tokenAddress: Address;
}

/**
 * Retrieves one token row with balance/fiat metadata for a wallet on a chain.
 * Reuses `retrieveTokensWithBalance` and selects the requested token.
 */
export async function retrieveTokenWithBalance(
  params: RetrieveTokenWithBalanceParams,
): Promise<TokenWithBalance> {
  const { walletAddress, chainId, tokenAddress } = params;

  if (!isValidAddress(walletAddress))
    throw new Error("Valid wallet address is required");

  if (!SUPPORTED_CHAIN_IDS.includes(chainId)) {
    throw new Error("Unsupported chainId");
  }
  if (!isValidAddress(tokenAddress, { allowNative: true, strict: false })) {
    throw new Error("Invalid token address");
  }

  const tokens = await retrieveTokensWithBalance(walletAddress, {
    networks: [chainId],
  });
  const tokenAddressKey = tokenAddress.toLowerCase();
  const match = tokens.find(
    (token) =>
      token.address.toLowerCase() === tokenAddressKey ||
      (tokenAddressKey === NATIVE_TOKEN_ADDRESS.toLowerCase() &&
        token.address.toLowerCase() === NATIVE_TOKEN_ADDRESS.toLowerCase()),
  );

  if (!match) {
    throw new Error("Token with balance not found");
  }

  return match;
}
