import type { APIRoute } from "astro";
import {
  ALCHEMY_NETWORKS,
  NATIVE_TOKEN_ADDRESS,
  SUPPORTED_NETWORKS,
  buildLogoUrl,
  stringifyWithBigInt,
  type Network,
  type TokenWithBalance,
} from "cooperative";
import {
  getNetworkFromAlchemyNetwork,
  validateAddress,
  validateApiKeyFromEnv,
} from "../../../utils/api";
import type {
  AlchemyToken,
  AlchemyTokensByAddressResponse,
} from "../../../types/api";
import type { Address } from "viem";

export const prerender = false;

/**
 * Maps an Alchemy API token response to {@link TokenWithBalance}.
 * Returns null for zero balances or when required metadata is missing.
 *
 * @param token - Raw token data from Alchemy Get Tokens by Address API.
 * @returns Normalized TokenWithBalance or null if unmappable.
 */
function toTokenWithBalance(token: AlchemyToken): TokenWithBalance | null {
  const balance = BigInt(token.tokenBalance);
  if (balance === BigInt(0)) return null;

  const tokenAddress = token.tokenAddress ?? NATIVE_TOKEN_ADDRESS;
  const isNativeToken = tokenAddress === NATIVE_TOKEN_ADDRESS;
  const networkDetailsIfNativeTokenIsPresent = isNativeToken
    ? getNetworkFromAlchemyNetwork(token.network)
    : null;

  const decimals =
    token.tokenMetadata?.decimals ??
    networkDetailsIfNativeTokenIsPresent?.nativeCurrency.decimals;
  if (!decimals) return null;

  const name =
    token.tokenMetadata?.name ??
    networkDetailsIfNativeTokenIsPresent?.nativeCurrency.name;
  if (!name) return null;

  const symbol =
    token.tokenMetadata?.symbol ??
    networkDetailsIfNativeTokenIsPresent?.nativeCurrency.symbol;
  if (!symbol) return null;

  const fiatCurrency = token.tokenPrices?.[0]?.currency;
  if (!fiatCurrency) return null;

  const lastUpdatedAt = token.tokenPrices?.[0]?.lastUpdatedAt;
  if (!lastUpdatedAt) return null;

  const priceUsd = token.tokenPrices?.[0]?.value;
  if (!priceUsd) return null;
  const price = parseFloat(priceUsd);
  const fiatBalance = (
    (Number(balance) / Math.pow(10, decimals)) *
    price
  ).toString();

  const chainId = getNetworkFromAlchemyNetwork(token.network).chainId;

  return {
    address: tokenAddress as `0x${string}`,
    chainId,
    decimals,
    name,
    symbol,
    fiatCurrency,
    lastUpdatedAt,
    fiatValue: priceUsd,
    balance,
    fiatBalance,
    logo: buildLogoUrl(tokenAddress, chainId),
  };
}

/**
 * GET /api/user/tokens
 *
 * Returns fungible tokens (native and ERC-20) with balances and metadata for a wallet
 * address across specified networks. Uses Alchemy Portfolio API under the hood.
 *
 * @queryParam address - Wallet address (required). Must be a valid Ethereum checksum address.
 * @queryParam networks - JSON array of chain IDs (required). Supported: 1 (Ethereum), 8453 (Base), 137 (Polygon).
 *
 * @response 200 - Array of {@link TokenWithBalance}. `balance` is serialized as string in JSON.
 * @response 400 - Invalid address or networks.
 * @response 500 - Alchemy API error or missing API key.
 *
 * @example
 * GET /api/user/tokens?address=0x1234...&networks=[1,8453,137]
 */
export const GET: APIRoute = async ({ request }) => {
  let apiKey: string;
  try {
    apiKey = validateApiKeyFromEnv("ALCHEMY_API_KEY");
  } catch {
    return new Response(
      JSON.stringify({ error: "ALCHEMY_API_KEY not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
  const url = new URL(request.url);
  let address: Address;
  try {
    address = validateAddress(
      url.searchParams.get("address"),
      "wallet address",
    );
  } catch {
    return new Response(
      JSON.stringify({ error: "Valid wallet address is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  let networks: Network[] = [];

  try {
    const _networksIds = url.searchParams.get("networks");
    const networksIds = _networksIds ? JSON.parse(_networksIds) : [];
    networks = SUPPORTED_NETWORKS.filter((network) =>
      networksIds.includes(network.chainId),
    );
    if (networks.length === 0) throw new Error("No networks found");
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Invalid networks parameter" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const response = await fetch(
    `https://api.g.alchemy.com/data/v1/${apiKey}/assets/tokens/by-address`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        addresses: [
          {
            address,
            networks: networks.map(
              (network) => ALCHEMY_NETWORKS[network.chainId],
            ),
          },
        ],
        withMetadata: true,
        withPrices: true,
        includeNativeTokens: true,
        includeErc20Tokens: true,
      }),
    },
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    console.error(error);
    return new Response(
      JSON.stringify({
        error: "Failed to fetch tokens",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const { data } = (await response.json()) as AlchemyTokensByAddressResponse;
  const tokens: TokenWithBalance[] = (data.tokens ?? [])
    .map(toTokenWithBalance)
    .filter((t): t is TokenWithBalance => t !== null);
  return new Response(stringifyWithBigInt(tokens), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
