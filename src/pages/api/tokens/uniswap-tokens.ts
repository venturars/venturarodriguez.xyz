import type { APIRoute } from "astro";
import type { Address } from "viem";
import type Redis from "ioredis";
import {
  SUPPORTED_CHAIN_IDS,
  buildLogoUrl,
  type TokenWithChainId,
} from "cooperative";
import type {
  UniswapTokenListJson,
  UniswapTokenListToken,
} from "../../../types/api";
import {
  getRedisClient,
  parseTokenListCacheFromRedis,
  persistTokenListToRedis,
} from "../../../utils/api";

export const prerender = false;

const UNISWAP_TOKEN_LIST_URL = "https://ipfs.io/ipns/tokens.uniswap.org";
const REDIS_KEY = "uniswap:default-token-list:supported-v3";
const CACHE_TTL_SEC = 12 * 60 * 60; // 12 hours
const STALE_BACKGROUND_REFRESH_AFTER_MS = 10 * 60 * 60 * 1000; // 10 hours
const MAX_STALE_SERVE_MS = CACHE_TTL_SEC * 1000; // align with Redis TTL: beyond this, block until fresh

/**
 * Parses `address` query parameters into a normalized lowercase set.
 *
 * Supports repeated params and comma-separated values:
 * `?address=0xabc&address=0xdef,0x123`.
 *
 * Returns `null` when no valid address filters are present.
 */
function parseAddressFilters(
  searchParams: URLSearchParams,
): Set<string> | null {
  const normalized: string[] = [];
  for (const value of searchParams.getAll("address")) {
    for (const part of value.split(",")) {
      const t = part.trim();
      if (!t) continue;
      normalized.push(
        t.startsWith("0x") ? t.toLowerCase() : `0x${t.toLowerCase()}`,
      );
    }
  }
  if (normalized.length === 0) return null;
  return new Set(normalized);
}

/** Maps one Uniswap token-list token into the app `TokenWithChainId` shape. */
function toTokenWithChainId(t: UniswapTokenListToken): TokenWithChainId {
  return {
    chainId: t.chainId,
    address: t.address as Address,
    decimals: t.decimals,
    name: t.name,
    symbol: t.symbol,
    logo: buildLogoUrl(t.address, t.chainId),
  };
}

/**
 * Fetches Uniswap's default token list and filters it by supported chains.
 *
 * Throws when upstream responds with a non-2xx status.
 */
async function fetchSupportedTokensFromUniswap(): Promise<TokenWithChainId[]> {
  const res = await fetch(UNISWAP_TOKEN_LIST_URL);
  if (!res.ok) {
    throw new Error(`Uniswap token list HTTP ${res.status}`);
  }
  const json = (await res.json()) as UniswapTokenListJson;
  return (json.tokens ?? [])
    .filter((t) => SUPPORTED_CHAIN_IDS.includes(t.chainId))
    .map(toTokenWithChainId);
}

/** Updates Redis after fetch; errors are logged only (does not reject). */
async function refreshRedisInBackground(redis: Redis): Promise<void> {
  try {
    const fresh = await fetchSupportedTokensFromUniswap();
    await persistTokenListToRedis(redis, REDIS_KEY, fresh, CACHE_TTL_SEC);
  } catch (err) {
    console.error("UniswapTokens background refresh:", err);
  }
}

/**
 * Loads supported tokens with stale-while-revalidate semantics.
 *
 * Behavior:
 * - cache age <= 10h: return cache
 * - 10h < cache age < 12h: return stale cache and refresh in background
 * - cache age >= 12h or unknown age: block for fresh fetch (fallback to stale)
 * - Redis unavailable or read error: fetch directly from upstream
 */
async function loadSupportedTokens(): Promise<TokenWithChainId[]> {
  const redis = getRedisClient();
  if (redis) {
    try {
      const cached = await redis.get(REDIS_KEY);
      if (cached) {
        const entry = parseTokenListCacheFromRedis(cached);
        if (entry) {
          const { tokens, fetchedAt } = entry;
          const ageMs = Date.now() - fetchedAt;

          if (fetchedAt > 0 && ageMs <= STALE_BACKGROUND_REFRESH_AFTER_MS) {
            return tokens;
          }

          const mustAwaitFresh = ageMs >= MAX_STALE_SERVE_MS;

          if (mustAwaitFresh) {
            try {
              const fresh = await fetchSupportedTokensFromUniswap();
              await persistTokenListToRedis(
                redis,
                REDIS_KEY,
                fresh,
                CACHE_TTL_SEC,
              );
              return fresh;
            } catch (err) {
              console.error("UniswapTokens sync refresh failed:", err);
              if (tokens.length > 0) return tokens;
              throw err;
            }
          }

          if (tokens.length > 0) {
            void refreshRedisInBackground(redis);
            return tokens;
          }

          try {
            const fresh = await fetchSupportedTokensFromUniswap();
            await persistTokenListToRedis(
              redis,
              REDIS_KEY,
              fresh,
              CACHE_TTL_SEC,
            );
            return fresh;
          } catch (err) {
            console.error(
              "UniswapTokens sync refresh failed (empty cache):",
              err,
            );
            throw err;
          }
        }
      }
    } catch (err) {
      console.error("UniswapTokens Redis read:", err);
    }
  }

  const fresh = await fetchSupportedTokensFromUniswap();
  if (redis) {
    try {
      await persistTokenListToRedis(redis, REDIS_KEY, fresh, CACHE_TTL_SEC);
    } catch (err) {
      console.error("UniswapTokens Redis write:", err);
    }
  }
  return fresh;
}

/**
 * GET /api/user/UniswapTokens
 *
 * Serves the Uniswap default token list filtered to app-supported chains, with optional
 * Redis cache (REDIS_URL, TTL 12h). Between 10h and 12h age, stale tokens are returned
 * immediately while Redis refreshes in the background. Older than 12h (or unknown age),
 * the handler waits for fresh data before responding (with stale fallback if fetch fails).
 * Response tokens are {@link TokenWithChainId}.
 * Query: address (repeat or comma-separated), chainId,
 * symbol (case-insensitive exact), name (case-insensitive substring).
 */
export const GET: APIRoute = async ({ request }) => {
  try {
    let tokens = await loadSupportedTokens();
    const url = new URL(request.url);
    const sp = url.searchParams;

    const addressSet = parseAddressFilters(sp);
    if (addressSet && addressSet.size > 0) {
      tokens = tokens.filter((t) => addressSet.has(t.address.toLowerCase()));
    }

    const chainIdRaw = sp.get("chainId");
    if (chainIdRaw !== null && chainIdRaw !== "") {
      const chainId = Number(chainIdRaw);
      if (Number.isFinite(chainId)) {
        tokens = tokens.filter((t) => t.chainId === chainId);
      }
    }

    const symbolRaw = sp.get("symbol");
    if (symbolRaw) {
      const sym = symbolRaw.trim().toLowerCase();
      tokens = tokens.filter((t) => t.symbol.toLowerCase() === sym);
    }

    const nameRaw = sp.get("name");
    if (nameRaw) {
      const needle = nameRaw.trim().toLowerCase();
      tokens = tokens.filter((t) => t.name.toLowerCase().includes(needle));
    }

    return new Response(JSON.stringify({ tokens }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("UniswapTokens:", err);
    return new Response(
      JSON.stringify({ error: "Failed to load token list" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
};
