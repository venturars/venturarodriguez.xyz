import type { APIRoute } from "astro";
import type { Address } from "viem";
import {
  alchemyPricesNetworkSlug,
  NATIVE_TOKEN_ADDRESS,
  SUPPORTED_NETWORKS,
} from "../../../../sdk/constants";
import type { TokenWithDetails } from "../../../../sdk/types";
import { buildLogoUrl } from "../../../../sdk/utils";
import {
  getRedisClient,
  validateAddress,
  validateApiKeyFromEnv,
  validateSupportedChainId,
} from "../../../../utils/api";
import type {
  AlchemyGetTokenMetadataResult,
  AlchemyPricesByAddressResponse,
  AlchemyPricesBySymbolResponse,
  AlchemyTokenPriceEntry,
} from "../../../../types/api";

export const prerender = false;
const CACHE_TTL_SEC = 30;

function tokenUnavailableResponse() {
  return new Response(
    JSON.stringify({
      error: "Token price not available",
      code: "TOKEN_UNAVAILABLE",
    }),
    { status: 404, headers: { "Content-Type": "application/json" } },
  );
}

function isNativeTokenAddress(a: string): boolean {
  return a.toLowerCase() === NATIVE_TOKEN_ADDRESS.toLowerCase();
}

async function alchemyJsonRpc<T>(
  rpcBaseUrl: string,
  apiKey: string,
  method: string,
  params: unknown[],
): Promise<T> {
  const res = await fetch(`${rpcBaseUrl}/${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params,
    }),
  });
  if (!res.ok) {
    throw new Error(`Alchemy RPC HTTP ${res.status}`);
  }
  const json = (await res.json()) as {
    result?: T;
    error?: { message: string };
  };
  if (json.error) {
    throw new Error(json.error.message);
  }
  return json.result as T;
}

async function fetchPriceByAddress(
  apiKey: string,
  chainId: number,
  contractAddress: string,
): Promise<AlchemyTokenPriceEntry | null> {
  const res = await fetch(
    `https://api.g.alchemy.com/prices/v1/${apiKey}/tokens/by-address`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        addresses: [
          {
            network: alchemyPricesNetworkSlug(chainId),
            address: contractAddress.toLowerCase(),
          },
        ],
      }),
    },
  );
  if (!res.ok) return null;
  const body = (await res.json()) as AlchemyPricesByAddressResponse;
  const row = body.data?.[0];
  if (!row || row.error || !row.prices?.length) return null;
  return row.prices[0];
}

async function fetchPriceBySymbol(
  apiKey: string,
  symbol: string,
): Promise<AlchemyTokenPriceEntry | null> {
  const u = new URL(
    `https://api.g.alchemy.com/prices/v1/${apiKey}/tokens/by-symbol`,
  );
  u.searchParams.append("symbols", symbol);
  const res = await fetch(u);
  if (!res.ok) return null;
  const body = (await res.json()) as AlchemyPricesBySymbolResponse;
  const row = body.data?.[0];
  if (!row || row.error || !row.prices?.length) return null;
  return row.prices[0];
}

/**
 * GET /api/token/:chainId/:address
 *
 * Returns {@link TokenWithDetails} from Alchemy (`alchemy_getTokenMetadata` + Prices API).
 * Path: supported `chainId` first, then token `address` (checksum or hex). Use native
 * placeholder `0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE` for the chain gas token.
 */
export const GET: APIRoute = async ({ params }) => {
  let apiKey: string;
  try {
    apiKey = validateApiKeyFromEnv("ALCHEMY_API_KEY");
  } catch {
    return new Response(
      JSON.stringify({ error: "ALCHEMY_API_KEY not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const chainIdRaw = params.chainId;
  const addressRaw = params.address;
  if (!chainIdRaw || !addressRaw) {
    return new Response(
      JSON.stringify({ error: "chainId and address are required" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  let chainId: number;
  try {
    chainId = validateSupportedChainId(chainIdRaw);
  } catch {
    return new Response(
      JSON.stringify({ error: "Unsupported or invalid chainId" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const trimmed = addressRaw.trim();
  let checksumAddress: Address;

  if (isNativeTokenAddress(trimmed)) {
    checksumAddress = NATIVE_TOKEN_ADDRESS as Address;
  } else {
    try {
      checksumAddress = validateAddress(trimmed, "token address");
    } catch {
      return new Response(JSON.stringify({ error: "Invalid token address" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  const network = SUPPORTED_NETWORKS.find((n) => n.chainId === chainId)!;
  const rpcBase = network.rpcUrls;
  const redis = getRedisClient();
  const cacheKey = `token:details:${chainId}:${checksumAddress.toLowerCase()}`;

  if (redis) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return new Response(cached, {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
    } catch (err) {
      console.error("TokenDetails Redis read:", err);
    }
  }

  try {
    let name: string;
    let symbol: string;
    let decimals: number;
    let logo: string;

    if (isNativeTokenAddress(checksumAddress)) {
      const nc = network.nativeCurrency;
      name = nc.name;
      symbol = nc.symbol;
      decimals = nc.decimals;
      logo = buildLogoUrl(NATIVE_TOKEN_ADDRESS, chainId);
      const price = await fetchPriceBySymbol(apiKey, nc.symbol);
      if (!price) {
        return tokenUnavailableResponse();
      }
      const body: TokenWithDetails = {
        address: NATIVE_TOKEN_ADDRESS as Address,
        chainId,
        decimals,
        name,
        symbol,
        logo,
        fiatValue: price.value,
        fiatCurrency: price.currency,
        lastUpdatedAt: price.lastUpdatedAt,
      };
      if (redis) {
        try {
          await redis.setex(cacheKey, CACHE_TTL_SEC, JSON.stringify(body));
        } catch (err) {
          console.error("TokenDetails Redis write:", err);
        }
      }
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const meta = await alchemyJsonRpc<AlchemyGetTokenMetadataResult | null>(
      rpcBase,
      apiKey,
      "alchemy_getTokenMetadata",
      [checksumAddress],
    );

    if (!meta?.name || !meta.symbol || typeof meta.decimals !== "number") {
      return new Response(
        JSON.stringify({
          error: "Token not found or incomplete metadata from Alchemy",
        }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      );
    }

    name = meta.name;
    symbol = meta.symbol;
    decimals = meta.decimals;
    logo = meta.logo?.trim() || buildLogoUrl(checksumAddress, chainId);

    const price = await fetchPriceByAddress(apiKey, chainId, checksumAddress);
    if (!price) {
      const fallback = await fetchPriceBySymbol(apiKey, symbol);
      if (!fallback) {
        return tokenUnavailableResponse();
      }
      const body: TokenWithDetails = {
        address: checksumAddress,
        chainId,
        decimals,
        name,
        symbol,
        logo,
        fiatValue: fallback.value,
        fiatCurrency: fallback.currency,
        lastUpdatedAt: fallback.lastUpdatedAt,
      };
      if (redis) {
        try {
          await redis.setex(cacheKey, CACHE_TTL_SEC, JSON.stringify(body));
        } catch (err) {
          console.error("TokenDetails Redis write:", err);
        }
      }
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body: TokenWithDetails = {
      address: checksumAddress,
      chainId,
      decimals,
      name,
      symbol,
      logo,
      fiatValue: price.value,
      fiatCurrency: price.currency,
      lastUpdatedAt: price.lastUpdatedAt,
    };
    if (redis) {
      try {
        await redis.setex(cacheKey, CACHE_TTL_SEC, JSON.stringify(body));
      } catch (err) {
        console.error("TokenDetails Redis write:", err);
      }
    }
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    if (err instanceof Error && err.message === "Token price not available") {
      return tokenUnavailableResponse();
    }
    console.error("GET /api/tokens/token/:chainId/:address", err);
    return new Response(
      JSON.stringify({
        error:
          err instanceof Error
            ? err.message
            : "Failed to load token from Alchemy",
      }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }
};
