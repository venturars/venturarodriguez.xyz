import { isAddress, parseUnits } from "viem";
import {
  NATIVE_TOKEN_ADDRESS,
  SMOL_TOKEN_ASSETS_BASE,
  SUPPORTED_NETWORKS,
  SMOL_DAPP_NETWORKS,
  TRUST_WALLET_ASSETS_BASE,
} from "./constants";
import type { Network } from "./types";

export function formatTokenBalance(
  balanceHex: string,
  decimals: number,
): string {
  const balance = BigInt(balanceHex);
  const divisor = BigInt(10 ** decimals);
  const whole = balance / divisor;
  const fraction = balance % divisor;
  const fractionStr = fraction
    .toString()
    .padStart(decimals, "0")
    .slice(0, decimals);
  const formatted =
    fractionStr === "0".repeat(decimals)
      ? whole.toString()
      : `${whole}.${fractionStr.replace(/0+$/, "")}`;
  return formatted;
}

export function stringifyWithBigInt(value: unknown): string {
  return JSON.stringify(value, (_, v) =>
    typeof v === "bigint" ? v.toString() : v,
  );
}

export function calculateBpsFromDelta(
  reference: bigint,
  delta: bigint,
): number {
  if (reference <= 0n || delta <= 0n) return 0;
  const bps = (delta * 10_000n) / reference;
  return Number(bps);
}

export function amountToUsdScaled(
  amount: bigint,
  fiatValue: string,
  decimals: number,
): bigint {
  return (parseUnits(fiatValue, 18) * amount) / 10n ** BigInt(decimals);
}

export function isValidBps(value: unknown): boolean {
  if (typeof value !== "number") return false;
  return Number.isInteger(value) && value >= 0 && value <= 10_000;
}

/**
 * Validates an Ethereum address string.
 *
 * Default behaviour matches wallet use: checksum strict, native sentinel rejected.
 *
 * @param options.allowNative - When true, accepts {@link NATIVE_TOKEN_ADDRESS} (any casing); for token refs, not wallets.
 * @param options.strict - EIP-55 when true (default); false allows all-lowercase contract strings.
 */
export function isValidAddress(
  address: unknown,
  options?: { allowNative?: boolean; strict?: boolean },
): boolean {
  if (typeof address !== "string") return false;
  if (
    options?.allowNative &&
    address.toLowerCase() === NATIVE_TOKEN_ADDRESS.toLowerCase()
  ) {
    return true;
  }
  const strict = options?.strict ?? true;
  return isAddress(address, { strict });
}

export function getNetwork(chainId: number): Network {
  const network = SUPPORTED_NETWORKS.find(
    (network) => network.chainId === chainId,
  );
  if (!network) throw new Error(`Network with chainId ${chainId} not found`);
  return network;
}

/**
 * Builds a token logo URL by chain + address.
 *
 * Uses SmolDapp token assets for ERC-20 contracts. For the native placeholder address, falls
 * back to Trust Wallet chain icon.
 */
export function buildLogoUrl(
  address: string,
  chainId: Network["chainId"],
): string {
  const blockchain = SMOL_DAPP_NETWORKS[chainId];
  if (!blockchain)
    throw new Error(`Unsupported chainId for Trust Wallet: ${chainId}`);

  if (address.toLowerCase() === NATIVE_TOKEN_ADDRESS.toLowerCase()) {
    return `${TRUST_WALLET_ASSETS_BASE}/${blockchain}/info/logo.png`;
  }

  const pathAddress = address.toLowerCase();
  return `${SMOL_TOKEN_ASSETS_BASE}/${chainId}/${pathAddress}/logo-128.png`;
}
