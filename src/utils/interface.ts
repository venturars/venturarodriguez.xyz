import { NATIVE_TOKEN_ADDRESS } from "../sdk/constants";
import type { TokenWithChainId } from "../sdk/types";
import { buildLogoUrl, getNetwork } from "../sdk/utils";
import { formatUnits, parseUnits } from "viem";
import EN from "../locales/EN.json";

const locales = EN.utils.interface;

export function buildPlaceholderTokenWithChainId(
  chainId: number,
): TokenWithChainId {
  const network = getNetwork(chainId);
  return {
    chainId,
    address: NATIVE_TOKEN_ADDRESS,
    decimals: network.nativeCurrency.decimals,
    name: network.nativeCurrency.name,
    symbol: network.nativeCurrency.symbol,
    logo: buildLogoUrl(NATIVE_TOKEN_ADDRESS, chainId),
  };
}

export function normalizeAmount(raw: string): number {
  const normalized = raw.trim().replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function normalizeNumericInput(raw: string): string {
  return raw.trim().replace(",", ".");
}

export function hasValidPositiveAmount(raw: string): boolean {
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0;
}

export function parseAmountToUnits(
  normalizedAmount: string,
  decimals: number,
): bigint | null {
  try {
    const parsed = parseUnits(normalizedAmount, decimals);
    return parsed > 0n ? parsed : null;
  } catch {
    return null;
  }
}

export function formatTokenAmount(amount: bigint, decimals: number): string {
  const normalized = Number(formatUnits(amount, decimals));
  if (!Number.isFinite(normalized)) return formatUnits(amount, decimals);
  return normalized.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 6,
  });
}

export function formatFiat(
  amount: number,
  currency: string,
  decimals: number = 2,
): string {
  const normalizedCurrency = currency.toUpperCase();
  const formatted = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: normalizedCurrency,
    currencyDisplay: normalizedCurrency === "USD" ? "narrowSymbol" : "symbol",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
  return normalizedCurrency === "USD"
    ? formatted.replace(/US\$/g, "$")
    : formatted;
}

export function formatBpsToPercent(bps?: number | null): string | undefined {
  if (bps === null || bps === undefined) return undefined;
  return (bps / 100).toFixed(2);
}

/**
 * Maps low-level transaction/provider errors to user-safe messages.
 */
export function getTransactionErrorMessage(error: unknown): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  const normalized = raw.toLowerCase();

  if (
    normalized.includes("user rejected") ||
    normalized.includes("rejected the request") ||
    normalized.includes("user denied") ||
    normalized.includes("user cancel") ||
    normalized.includes("4001")
  ) {
    return locales.transactionErrors.cancelledInWallet;
  }

  if (normalized.includes("insufficient funds")) {
    return locales.transactionErrors.insufficientFundsForGas;
  }

  return locales.transactionErrors.genericFailure;
}

export function interpolateTemplate(
  template: string,
  variables: Record<string, string | number>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    const value = variables[key];
    return value === undefined ? match : String(value);
  });
}
