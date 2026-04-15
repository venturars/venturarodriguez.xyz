import type { APIRoute } from "astro";
import type { Address } from "viem";
import { buildLogoUrl, type TokenWithChainId } from "cooperative";
import {
  getRedisClient,
  parseTokenListCacheFromRedis,
  persistTokenListToRedis,
  validateApiKeyFromEnv,
  validateRequiredEnv,
  validateSupportedChainId,
} from "../../../utils/api";
import type {
  BlockscoutTokenItem,
  BlockscoutTokensListResponse,
} from "../../../types/api";

export const prerender = false;

const DEFAULT_ITEMS_COUNT = 50;
const MIN_ITEMS_COUNT = 1;
const MAX_ITEMS_COUNT = 50;
const CACHE_TTL_SEC = 12 * 60 * 60; // 12 hours
const STALE_BACKGROUND_REFRESH_AFTER_MS = 10 * 60 * 60 * 1000; // 10 hours
const MAX_STALE_SERVE_MS = CACHE_TTL_SEC * 1000; // 12 hours
const REDIS_KEY_PREFIX = "blockscout:tokens:v1";

/**
 * Parses the optional `itemsCount` query param.
 *
 * @param raw - Raw query value.
 * @returns Sanitized item count.
 * @throws {Error} When value is not an integer in `[1, 50]`.
 */
function parseItemsCount(raw: string | null): number {
  if (!raw || raw.trim() === "") return DEFAULT_ITEMS_COUNT;
  const parsed = Number(raw);
  if (
    !Number.isInteger(parsed) ||
    parsed < MIN_ITEMS_COUNT ||
    parsed > MAX_ITEMS_COUNT
  ) {
    throw new Error(
      `itemsCount must be an integer between ${MIN_ITEMS_COUNT} and ${MAX_ITEMS_COUNT}`,
    );
  }
  return parsed;
}

/**
 * Maps one Blockscout token row to the app `TokenWithChainId` shape.
 *
 * Only valid ERC-20 rows are accepted. Invalid/unsupported rows return `null`.
 */
function toTokenWithChainId(
  chainId: number,
  item: BlockscoutTokenItem,
): TokenWithChainId | null {
  if (item.type !== "ERC-20") return null;
  if (!item.address_hash || !item.address_hash.startsWith("0x")) return null;
  const decimals = Number(item.decimals);
  if (!Number.isInteger(decimals) || decimals < 0) return null;

  return {
    chainId,
    address: item.address_hash as Address,
    decimals,
    name: item.name?.trim() || "Unknown token",
    symbol: item.symbol?.trim() || "UNKNOWN",
    logo: buildLogoUrl(item.address_hash, chainId),
  };
}

/**
 * Fetches token rows from Blockscout and normalizes them to `TokenWithChainId[]`.
 *
 * @throws {Error} When Blockscout responds with non-2xx.
 */
async function fetchTokensFromBlockscout(
  chainId: number,
  itemsCount: number,
  query: string | undefined,
  apiKey: string,
  configuredBaseUrl: string,
): Promise<TokenWithChainId[]> {
  const upstreamParams = new URLSearchParams();
  upstreamParams.set("apikey", apiKey);
  upstreamParams.set("type", "ERC-20");
  upstreamParams.set("items_count", String(itemsCount));
  if (query) upstreamParams.set("q", query);

  const blockscoutBaseUrl = configuredBaseUrl.replace(
    "{chain_id}",
    chainId.toString(),
  );
  const upstreamUrl = `${blockscoutBaseUrl}/tokens/?${upstreamParams.toString()}`;

  const upstreamResponse = await fetch(upstreamUrl);
  if (!upstreamResponse.ok) {
    const error = await upstreamResponse.json().catch(() => ({}));
    console.error("Blockscout tokens upstream error:", error);
    throw new Error("Failed to fetch Blockscout tokens");
  }

  const body = (await upstreamResponse.json()) as BlockscoutTokensListResponse;
  const items = Array.isArray(body.items) ? body.items : [];
  return items
    .map((item) => toTokenWithChainId(chainId, item))
    .filter((token): token is TokenWithChainId => token !== null);
}

/**
 * Refreshes Redis cache asynchronously (fire-and-forget call site).
 *
 * Any error is logged and intentionally swallowed to avoid affecting responses.
 */
async function refreshRedisInBackground(
  chainId: number,
  itemsCount: number,
  query: string | undefined,
  apiKey: string,
  configuredBaseUrl: string,
  cacheKey: string,
): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    const fresh = await fetchTokensFromBlockscout(
      chainId,
      itemsCount,
      query,
      apiKey,
      configuredBaseUrl,
    );
    await persistTokenListToRedis(redis, cacheKey, fresh, CACHE_TTL_SEC);
  } catch (error) {
    console.error("Blockscout tokens background refresh:", error);
  }
}

/**
 * GET /api/tokens/blockscout-tokens
 *
 * Returns Blockscout token rows normalized to `TokenWithChainId` (ERC-20 only).
 *
 * Cache strategy mirrors `uniswap-tokens`:
 * - fresh cache (<= 10h): return cached tokens
 * - stale cache (10h-12h): return cached tokens and refresh in background
 * - expired cache (>= 12h): block for fresh fetch (fallback to stale if available)
 * - no cache: fetch from upstream and persist
 *
 * Query:
 * - `chainId` (required): supported chain id.
 * - `q` (optional): search query matched by Blockscout against token name/symbol.
 * - `itemsCount` (optional): page size from 1 to 50. Defaults to 50.
 */
export const GET: APIRoute = async ({ request }) => {
  let apiKey: string;
  try {
    apiKey = validateApiKeyFromEnv("BLOCKSCOUT_API_KEY");
  } catch {
    return new Response(
      JSON.stringify({ error: "BLOCKSCOUT_API_KEY not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
  let configuredBaseUrl: string;
  try {
    configuredBaseUrl = validateRequiredEnv("BLOCKSCOUT_API_URL");
  } catch {
    return new Response(
      JSON.stringify({ error: "BLOCKSCOUT_API_URL not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const url = new URL(request.url);

  let chainId: number;
  let itemsCount: number;
  try {
    chainId = validateSupportedChainId(url.searchParams.get("chainId"));
    itemsCount = parseItemsCount(url.searchParams.get("itemsCount"));
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Invalid query params",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const query = url.searchParams.get("q")?.trim();
  const normalizedQuery = (query ?? "").toLowerCase();

  const redis = getRedisClient();
  const cacheKey = `${REDIS_KEY_PREFIX}:${chainId}:${itemsCount}:${encodeURIComponent(normalizedQuery)}`;

  if (redis) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        const entry = parseTokenListCacheFromRedis(cached);
        if (entry) {
          const { tokens, fetchedAt } = entry;
          const ageMs = Date.now() - fetchedAt;

          if (fetchedAt > 0 && ageMs <= STALE_BACKGROUND_REFRESH_AFTER_MS) {
            return new Response(JSON.stringify({ tokens }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }

          const mustAwaitFresh = ageMs >= MAX_STALE_SERVE_MS;

          if (mustAwaitFresh) {
            try {
              const fresh = await fetchTokensFromBlockscout(
                chainId,
                itemsCount,
                query,
                apiKey,
                configuredBaseUrl,
              );
              await persistTokenListToRedis(
                redis,
                cacheKey,
                fresh,
                CACHE_TTL_SEC,
              );
              return new Response(JSON.stringify({ tokens: fresh }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
              });
            } catch (error) {
              console.error("Blockscout tokens sync refresh failed:", error);
              if (tokens.length > 0) {
                return new Response(JSON.stringify({ tokens }), {
                  status: 200,
                  headers: { "Content-Type": "application/json" },
                });
              }
              throw error;
            }
          }

          if (tokens.length > 0) {
            void refreshRedisInBackground(
              chainId,
              itemsCount,
              query,
              apiKey,
              configuredBaseUrl,
              cacheKey,
            );
            return new Response(JSON.stringify({ tokens }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }

          try {
            const fresh = await fetchTokensFromBlockscout(
              chainId,
              itemsCount,
              query,
              apiKey,
              configuredBaseUrl,
            );
            await persistTokenListToRedis(
              redis,
              cacheKey,
              fresh,
              CACHE_TTL_SEC,
            );
            return new Response(JSON.stringify({ tokens: fresh }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          } catch (error) {
            console.error(
              "Blockscout tokens sync refresh failed (empty cache):",
              error,
            );
            throw error;
          }
        }
      }
    } catch (error) {
      console.error("Blockscout tokens Redis read:", error);
    }
  }

  try {
    const tokens = await fetchTokensFromBlockscout(
      chainId,
      itemsCount,
      query,
      apiKey,
      configuredBaseUrl,
    );

    if (redis) {
      try {
        await persistTokenListToRedis(redis, cacheKey, tokens, CACHE_TTL_SEC);
      } catch (error) {
        console.error("Blockscout tokens Redis write:", error);
      }
    }

    return new Response(JSON.stringify({ tokens }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Blockscout tokens:", error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch Blockscout tokens" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
};
