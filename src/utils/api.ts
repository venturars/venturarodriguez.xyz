import Redis from "ioredis";
import { formatUnits, getAddress, type Address } from "viem";
import {
  ALCHEMY_NETWORKS,
  SUPPORTED_CHAIN_IDS,
  SUPPORTED_NETWORKS,
} from "../sdk/constants";
import { isValidAddress } from "../sdk/utils";
import { amountToUsdScaled } from "../sdk/utils";
import type { Network, SwapFee, TokenWithChainId } from "../sdk/types";
import { retrieveTokenWithDetails } from "../sdk/token/retrieveTokenWithDetails";
import type { ResolveTokenDetails, ZeroExFeeEntry } from "../types/api";

export function getAlchemyUrl(network: Network["chainId"]): string {
  const subdomain = ALCHEMY_NETWORKS[network];
  return `https://${subdomain}.g.alchemy.com/v2`;
}

export function getNetworkFromAlchemyNetwork(alchemyNetwork: string): Network {
  const network = SUPPORTED_NETWORKS.find(
    (network) => ALCHEMY_NETWORKS[network.chainId] === alchemyNetwork,
  );
  if (!network)
    throw new Error(`Network with alchemyNetwork ${alchemyNetwork} not found`);
  return network;
}

export function validateSupportedChainId(
  rawChainId: string | null | undefined,
  fieldName: string = "chainId",
): Network["chainId"] {
  if (!rawChainId) {
    throw new Error(`${fieldName} is required`);
  }
  const chainId = Number(rawChainId);
  if (!Number.isInteger(chainId) || !SUPPORTED_CHAIN_IDS.includes(chainId)) {
    throw new Error(`Unsupported or invalid ${fieldName}`);
  }
  return chainId as Network["chainId"];
}

export function validateRequiredEnv(envName: string): string {
  const rawFromImportMeta = (import.meta.env as Record<string, unknown>)[
    envName
  ];
  const rawFromProcess =
    typeof process !== "undefined" ? process.env?.[envName] : undefined;
  const raw =
    typeof rawFromImportMeta === "string" && rawFromImportMeta.trim() !== ""
      ? rawFromImportMeta
      : rawFromProcess;
  if (typeof raw !== "string" || raw.trim() === "") {
    throw new Error(`${envName} not configured`);
  }
  return raw;
}

export function validateApiKeyFromEnv(envName: string): string {
  return validateRequiredEnv(envName);
}

export function validateAddress(
  rawAddress: string | null | undefined,
  fieldName: string = "address",
): Address {
  if (!rawAddress) {
    throw new Error(`${fieldName} is required`);
  }
  if (!isValidAddress(rawAddress, { strict: false })) {
    throw new Error(`Invalid ${fieldName}`);
  }
  return getAddress(rawAddress) as Address;
}

export function parseOptionalBps(
  raw: string | null,
  name: string,
  fallback: number,
): number {
  if (raw === null || raw.trim() === "") return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 10_000) {
    throw new Error(`${name} must be an integer between 0 and 10000`);
  }
  return parsed;
}

export function parsePositiveBigInt(raw: string | null, name: string): bigint {
  if (!raw) throw new Error(`${name} is required`);
  if (!/^\d+$/.test(raw)) throw new Error(`${name} must be an integer string`);
  const value = BigInt(raw);
  if (value <= 0n) throw new Error(`${name} must be greater than 0`);
  return value;
}

/**
 * Creates a memoized token details resolver scoped to a single request.
 * Repeated calls for the same `chainId + address` share the same in-flight promise.
 */
export function createTokenDetailsResolver(
  tokenDetailsResolver: ResolveTokenDetails = retrieveTokenWithDetails,
): ResolveTokenDetails {
  const cache = new Map<string, ReturnType<ResolveTokenDetails>>();
  return (chainId, address) => {
    const cacheKey = `${chainId}:${address.toLowerCase()}`;
    const existing = cache.get(cacheKey);
    if (existing) return existing;

    const request = tokenDetailsResolver(chainId, address).catch((error) => {
      cache.delete(cacheKey);
      throw error;
    });
    cache.set(cacheKey, request);
    return request;
  };
}

/**
 * Maps a 0x fee entry into the internal `SwapFee` model.
 * Returns `null` for missing or invalid fee payloads.
 */
export async function getSwapFee(
  chainId: number,
  entry: ZeroExFeeEntry | null | undefined,
  type: SwapFee["type"],
  resolveTokenDetails: ResolveTokenDetails,
): Promise<SwapFee | null> {
  if (!entry?.token || !entry?.amount) return null;
  if (!isValidAddress(entry.token, { strict: false })) return null;
  const token = getAddress(entry.token);
  let tokenDetails;
  try {
    tokenDetails = await resolveTokenDetails(chainId, token);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("Token price not available")
    ) {
      return null;
    }
    throw error;
  }
  const amountUsd = amountToUsdScaled(
    BigInt(entry.amount),
    tokenDetails.fiatValue,
    tokenDetails.decimals,
  );

  return {
    type,
    token,
    amount: BigInt(entry.amount),
    amountUsd: formatUnits(amountUsd, 18),
  };
}

let redisClient: Redis | null = null;

export function isRedisEnabled(): boolean {
  const raw = import.meta.env.REDIS_ENABLED;
  if (typeof raw !== "string" || raw.trim() === "") return true;
  const normalized = raw.trim().toLowerCase();
  return !["false", "0", "no", "off"].includes(normalized);
}

export function getRedisClient(): Redis | null {
  if (!isRedisEnabled()) return null;

  const url = import.meta.env.REDIS_URL;
  if (!url || typeof url !== "string") return null;

  if (!redisClient) {
    redisClient = new Redis(url, {
      maxRetriesPerRequest: 2,
      lazyConnect: true,
    });
  }

  return redisClient;
}

/**
 * Persists a token-list payload in Redis with a fetch timestamp.
 *
 * The stored JSON shape is `{ fetchedAt, tokens }`, which is reused by token-list
 * API endpoints for cache reads and stale-age checks.
 */
export async function persistTokenListToRedis(
  redis: Redis,
  cacheKey: string,
  tokens: TokenWithChainId[],
  ttlSec: number,
): Promise<void> {
  await redis.setex(
    cacheKey,
    ttlSec,
    JSON.stringify({
      fetchedAt: Date.now(),
      tokens,
    }),
  );
}

/**
 * Parses token-list cache payload from Redis.
 *
 * Expected JSON shape: `{ fetchedAt: number, tokens: TokenWithChainId[] }`.
 * Returns `null` when payload is malformed.
 */
export function parseTokenListCacheFromRedis(raw: string): {
  tokens: TokenWithChainId[];
  fetchedAt: number;
} | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;

    const payload = parsed as { fetchedAt?: unknown; tokens?: unknown };
    if (!Array.isArray(payload.tokens)) return null;
    if (
      typeof payload.fetchedAt !== "number" ||
      !Number.isFinite(payload.fetchedAt) ||
      payload.fetchedAt <= 0
    ) {
      return null;
    }

    const tokens = payload.tokens.filter(
      (row): row is TokenWithChainId =>
        !!row &&
        typeof row === "object" &&
        typeof (row as { chainId?: unknown }).chainId === "number" &&
        typeof (row as { address?: unknown }).address === "string" &&
        typeof (row as { decimals?: unknown }).decimals === "number" &&
        typeof (row as { name?: unknown }).name === "string" &&
        typeof (row as { symbol?: unknown }).symbol === "string" &&
        typeof (row as { logo?: unknown }).logo === "string",
    );
    if (tokens.length !== payload.tokens.length) return null;

    return { tokens, fetchedAt: payload.fetchedAt };
  } catch {
    return null;
  }
}
